import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as saml from "common/saml"
import { z } from "zod/v4"
import * as r from "common/result"
import * as jwt from "jsonwebtoken"
import { setCookie, getCookie, deleteCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import * as db from "./db"
import { connection } from "./connection"
import * as html from "./html"

const loginForm = z.object({
  username: z.string().email(),
})

const assertionForm = z.object({
  SAMLResponse: z.string(),
  RelayState: z.string(),
})

const session = z.object({
  username: z.string().email()
})
type Session = z.infer<typeof session>

const env = {
  jwtSecret: process.env["TEST_SP_JWT_SECRET"] ?? ""
}

const authCookieName = "sp_auth"

const app = new Hono()
app.use(logger())
const authMiddleware = createMiddleware <{ Variables: { session: Session } }> (async (c, next) => {
  // don't authenticate the login or acs paths
  if (c.req.path === "/login" || c.req.path === "/acs") {
    await next()
  }
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
app.use(authMiddleware)

app.get("/", authMiddleware, async (c) => {
  const props = {
    siteData: {
      title: "SP Home",
    },
    username: c.var.session.username,
  }
  return c.html(<html.Home { ...props }></html.Home>)
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const props = {
    siteData: {
      title: "SP Login"
    }
  }
  return c.html(<html.Login { ...props }></html.Login>)
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const login = loginForm.parse(body)
  console.log("login.username", login.username)

  // at this point we would use the entered email address to choose
  // the IdP which we want to use to authenticate the user
  // but now simply redirect to the test IdP
  const relayState = `rs-${crypto.randomUUID()}`

  // record the relaystate and email in the db
  db.recordRelayState({
    relayState,
    email: login.username,
  })

  // finally redirect to the IdP
  const result = saml.generateAuthnRequest({ connection, relayState })
  return c.redirect(result.url)
})

app.post("/acs", async (c) => {
  const body = await c.req.parseBody()
  const form = assertionForm.parse(body)
  const assertionExtract = saml.parseAssertion(form.SAMLResponse)

  // TODO: Here we can lookup the correct connection for this Assertion
  console.log("Assertion from IdP: ", assertionExtract.issuer)

  // validate the relayState
  const relayStateResult = db.consumeRelayState({ relayState: form.RelayState })
  const emailCheckResult = r.bind(
    relayStateResult,
    (relayState) => relayState.email === assertionExtract.nameID
      ? r.from(true)
      : r.fail(`SP Error invalid email: expected: ${relayState.email}, got: ${assertionExtract.nameID}`)
  )

  // validate the assertion certificate etc
  const assertionResult = await r.bindAsync(
    emailCheckResult,
    () => saml.validateAssertion({ connection, encodedAssertion: form.SAMLResponse }))

  const result = r.map(assertionResult, () => {
    // We've successfully validated the SAML Assertion, so now we can issue a JWT for our application
    const session: Session = { username: assertionExtract.nameID }
    const token = jwt.sign(session, env.jwtSecret, { expiresIn: '1h' })
    setCookie(c, authCookieName, token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1h
      sameSite: "Lax",
    })
  })

  if (r.isOk(result)) {
    return c.redirect("/")
  }
  else {
    console.log(`SP Error validating assertion: ${result.message}`)
    const errorProps = (typeof result.message === "string")
      ? {
        status: 401,
        title: "Not Authenticated",
        message: result.message
      } as const
      : {
        status: 500,
        title: "Internal Server Error",
        message: "Oh dear, a bug. See logs for details.",
      } as const
    const props = {
      siteData: {
        title: "SP Error",
      },
      ... errorProps,
    }
    c.status(props.status)
    return c.html(<html.Error {...props}></html.Error>)
  }
})

app.notFound((c) => {
  const props = {
    siteData: {
      title: "Not Found"
    },
    status: 404,
    title: "Not Found",
    message: "There's nothing to see here, move along please."
  } as const
  c.status(props.status)
  return c.html(<html.Error {...props }></html.Error>)
})

export default app
