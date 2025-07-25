import { Hono, type Context } from 'hono'
import { logger } from 'hono/logger'
import * as saml from "common/saml"
import { z } from "zod/v4"
import * as r from "common/result"
import { cspMiddleware, type ContextWithNonce } from "common/hono"
import * as jwt from "jsonwebtoken"
import { setCookie, getCookie, deleteCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import { recordRelayState, consumeRelayState, spPrivateTables, getUser, getAllUsersAndConnections } from "./db"
import { createDb, createIdpConnectionTable, getIdpConnection } from "common/db"
import { initializeDb } from "./connection"
import * as html from "./html"

const loginForm = z.object({
  username: z.email(),
})

const assertionForm = z.object({
  SAMLResponse: z.string(),
  RelayState: z.string(),
})

const session = z.object({
  username: z.email()
})
type Session = z.infer<typeof session>

const env = z.object({
  jwtSecret: z.string().min(32),
  testIdpUrl: z.url(),
}).parse({
  jwtSecret: process.env["TEST_SP_JWT_SECRET"],
  testIdpUrl: process.env["TEST_IDP_URL_BASE"]
})

const authCookieName = "sp_auth"

const con = createDb([ spPrivateTables, createIdpConnectionTable ])
initializeDb(con)

const app = new Hono<ContextWithNonce>()
app.use(logger())
app.use(cspMiddleware())

const authMiddleware = createMiddleware <{ Variables: { session: Session } }> (async (c, next) => {
  const token = getCookie(c, authCookieName)
  if (!token) {
    return c.redirect("/login")
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    const decodedSession = session.parse(decoded)
    c.set("session", decodedSession)
  }
  catch (e) {
    console.log(`JWT verify failed with ${e}`)
    return c.redirect("/login")
  }
  await next()
})

const errorResult = (c: Context, fail: r.Fail) => {
  const errorProps = (typeof fail.message === "string")
    ? {
      status: 401,
      title: "Not Authenticated",
      message: fail.message
    } as const
    : {
      status: 500,
      title: "Internal Server Error",
      message: "Oh dear, a bug. See logs for details.",
    } as const
  const props = {
    siteData: {
      title: "SP Error",
      nonce: c.var["nonce"],
    },
    ... errorProps,
  }
  c.status(props.status)
  return c.html(html.Error(props).toString())
}

// Home is the only JWT protected route.
app.get("/", authMiddleware, async (c) => {
  const props = {
    siteData: {
      title: "SP Home",
      nonce: c.var["nonce"],
    },
    username: c.var.session.username,
  }
  return c.html(html.Home(props).toString())
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const userConnections = getAllUsersAndConnections(con)
  const props = {
    siteData: {
      title: "SP Login",
      nonce: c.var["nonce"],
    },
    testIdpUrl: env.testIdpUrl,
    userConnections,
  }
  return c.html(html.Login(props).toString())
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const loginResult = r.attempt(() => loginForm.parse(body))
  r.run(loginResult, (login) => console.log("login.username", login.username))
  const userResult = r.bind(loginResult, (login) => getUser(con, { email: login.username }))
  const connectionResult = r.bind(userResult, (user) => getIdpConnection(con, { idpEntityId: user.idpEntityId }))
  const aunthnRequestResult = r.map(connectionResult, (connection) => {
    // record the relaystate and email in the db
    const relayState = `rs-${crypto.randomUUID()}`
    const request = saml.generateAuthnRequest({ connection, relayState })
    r.run(userResult, (user) => {
      recordRelayState(con, {
        relayState,
        requestId: request.id,
        email: user.email,
      })
    })
    return request
  })

  if (r.isOk(aunthnRequestResult)) {
    // finally redirect to the IdP
    return c.redirect(aunthnRequestResult.value.url)
  }
  return errorResult(c, aunthnRequestResult)
})

app.post("/sp/acs", async (c) => {
  const body = await c.req.parseBody()
  const formResult = r.attempt(() => assertionForm.parse(body))
  const assertionExtractResult = r.map(formResult, (form) => saml.parseAssertion(form.SAMLResponse))

  const userValidationResult = r.validate(assertionExtractResult, (assertionExtract) => {
    const userResult = getUser(con, { email: assertionExtract.nameID })
    return r.bind(userResult, (user) =>
      (user.idpEntityId === assertionExtract.issuer)
        ? r.voidResult
        : r.fail(`Invalid connection for ${user.email}`))
  })

  const connectionResult = r.bind(
    r.merge2(userValidationResult, assertionExtractResult),
    (ctx) => getIdpConnection(con, { idpEntityId: ctx.b.issuer }))

  // validate the relayState
  const relayStateValidationResult = r.validate(
    r.merge3(formResult, assertionExtractResult, connectionResult),
    (ctx) => {
      // if no relayState is given, assume an IdP-iniitated request
      if(!ctx.a.RelayState) {
        // confirm that the assertion does not have an inResponseTo id set.
        return ( ctx.b.inResponseTo === undefined && ctx.c.spAllowIdpInitiated )
          ? r.voidResult // success
          : r.fail("An IdP initiated request must not have an inResponseTo id set.")
      }
      const relayStateResult = consumeRelayState(con, { relayState: ctx.a.RelayState })
      return r.bind(
        relayStateResult,
        (relayState) => (relayState.email === ctx.b.nameID && relayState.request_id === ctx.b.inResponseTo)
          ? r.voidResult // success
          : r.fail(`SP Error invalid email: expected: ${relayState.email}, got: ${ctx.b.nameID}`)
      )
    })

  // validate the assertion certificate etc
  const assertionValidationResult = await r.validateAsync(
    relayStateValidationResult,
    (ctx) => saml.validateAssertion({ connection: ctx.c, encodedAssertion: ctx.a.SAMLResponse }))

  // We've successfully validated the SAML Assertion, so now we can issue a JWT for our application
  r.run(
    assertionValidationResult,
    (ctx) => {
      const session: Session = { username: ctx.b.nameID }
      const token = jwt.sign(session, env.jwtSecret, { expiresIn: '1h' })
      setCookie(c, authCookieName, token, {
        httpOnly: true,
        maxAge: 60 * 60 * 1000, // 1h
        sameSite: "Lax",
      })
    })

  if (r.isOk(assertionValidationResult)) {
    return c.redirect("/")
  }
  else {
    console.log(`SP Error validating assertion: ${assertionValidationResult.message}`)
    return errorResult(c, assertionValidationResult)
  }
})

app.notFound((c) => {
  const props = {
    siteData: {
      title: "Not Found",
      nonce: c.var["nonce"],
    },
    status: 404,
    title: "Not Found",
    message: "There's nothing to see here, move along please."
  } as const
  c.status(props.status)
  return c.html(html.Error(props).toString())
})

export default app
