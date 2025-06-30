import { getAllSpConnections, getSpConnection, getSpConnectionById } from "common/db"
import * as r from "common/result"
import * as saml from "common/saml"
import { cspMiddleware, type ContextWithNonce } from "common/hono"
import { Hono, type Context } from 'hono'
import { serveStatic } from "hono/bun"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import * as jwt from "jsonwebtoken"
import { z } from "zod/v4"
import { initDb, getUser } from "./db"
import * as html from "./html"

const loginForm = z.object({
  username: z.email(),
  redirect_to: z.string(),
})

const authnRequest = z.object({
  SAMLRequest: z.string(),
  RelayState: z.string(),
})

const session = z.object({
  username: z.email()
})
type Session = z.infer<typeof session>

const authCookieName = "idp_auth"
const redirectQueryParam = "redirect_to"
const siteData = (title: string, nonce: string): html.SiteData => ({ title, nonce })

const env = z.object({
  jwtSecret: z.string().min(32),
}).parse({
  jwtSecret: process.env["TEST_IDP_JWT_SECRET"],
})

const con = initDb()
// const app = new Hono<{ Variables: { nonce: string } }>()
const app = new Hono<ContextWithNonce>()
app.use(logger())
app.use("/js/*", serveStatic({ root: "./static" }))
app.use("/css/*", serveStatic({ root: "./static" }))
app.use(cspMiddleware())

const authMiddleware = createMiddleware <{ Variables: { session: Session } }> (async (c, next) => {
  // if the AuthnRequest hits the /sso path, but the user hasn't already logged in
  // this authMiddleware will bounce them through the login process. After they've
  // authenticated, we'll redirect them to /sso. Here we pass the orginal authnRequest
  // through a querystring param
  const redirectTo = (() => {
    const url = new URL(c.req.url)
    return encodeURIComponent(`${url.pathname}?${url.searchParams}`)
  })()
  const token = getCookie(c, authCookieName)
  if (!token) {
    return c.redirect(`/login?${redirectQueryParam}=${redirectTo}`)
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    const decodedSession = session.parse(decoded)
    c.set("session", decodedSession)
  }
  catch (e) {
    console.log(`JWT verify failed with ${e}`)
    return c.redirect(`/login?${redirectQueryParam}=${redirectTo}`)
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


app.get("/", authMiddleware, async (c) => {
  const userResult = getUser(con, { email: c.var.session.username })
  const connectionResult = r.bind(userResult, (user) => getSpConnectionById(con, { id: user.connectionId }))
  if (r.isOk(connectionResult)) {
    return c.html(html.Home({
      siteData: siteData("IdP Home", c.var["nonce"]),
      ...c.var.session,
      connections: [connectionResult.value],
    }).toString())
  }
  else {
    console.log(`Error getting user connection: ${connectionResult.message}`)
    return errorResult(c, connectionResult)
  }
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const redirectTo = c.req.query(redirectQueryParam) ?? "/"
  return c.html(html.Login({ siteData: siteData("IdP Login", c.var["nonce"]), redirectTo }).toString())
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const loginResult = r.attempt(() => loginForm.parse(body))

  // Here a real IdP would validate the user's credientials.
  // This test IdP accepts whatever is entered.
  const userResult = r.bind(loginResult, (login) => getUser(con, { email: login.username }))

  // The user has authenticated, so now we can issue a JWT
  const result = r.run(userResult, (user) => {
    const session: Session = { username: user.email }
    const token = jwt.sign(session, env.jwtSecret, { expiresIn: '1h' })
    setCookie(c, authCookieName, token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1h
      sameSite: "Lax",
    })
  })

  if (r.isOk(result)) {
    // it is, this is just type narrowing here
    if (r.isOk(loginResult)) {
      return c.redirect(loginResult.value.redirect_to)
    }
  }
  else {
    console.log(`Error logging in user: ${result.message}`)
    return errorResult(c, result)
  }
})

app.get("/idp/sso", authMiddleware, async (c) => {
  const requestResult = r.attempt(() => authnRequest.parse(c.req.query()))

  const parseResult = r.bind(requestResult,
    (request) => saml.parseAuthnRequest({ authnRequest: request.SAMLRequest }))

  const userResult = getUser(con, { email: c.var.session.username })

  const connectionResult = r.bind(parseResult,
    (request) => getSpConnection(con, { spEntityId: request.issuer }))

  const validateConnectionResult = r.validate(
    r.merge2(userResult, connectionResult),
    (ctx) => (ctx.a.connectionId === ctx.b.id)
      ? r.voidResult
      : r.fail("Invalid connection for the logged in user.")
  )

  const validationResult = r.validate(
    r.merge3(parseResult, connectionResult, validateConnectionResult),
    (ctx) => saml.validateAuthnRequest({ connection: ctx.b, details: ctx.a }))

  const assertionProps = r.map(
    r.merge3(requestResult, parseResult, validationResult),
    (ctx) => ({
    user: {
      email: c.var.session.username
    },
    relayState: ctx.a.RelayState,
    requestId: ctx.b.id,
  }))

  const result = await r.mapAsync(
    r.merge2(connectionResult, assertionProps),
    (ctx) =>   saml.generateAssertion({ connection: ctx.a, ...ctx.b }))

  if (r.isOk(result)) {
    return c.html(html.Assertion({ ...result.value, nonce: c.var.nonce }))
  }
  else {
    console.log(`IdP Error validating authnRequest: ${result.message}`)
    return errorResult(c, result)
  }
})

app.get("/idp/iif/:connectionId", authMiddleware, async (c) => {
  const connectionId = c.req.param("connectionId");

  const connectionResult = getSpConnectionById(con, { id: connectionId })
  const userResult = getUser(con, { email: c.var.session.username })

  const connectionValidationResult = r.validate(
    r.merge2(userResult, connectionResult),
    (ctx) => (ctx.a.connectionId === ctx.b.id) ? r.voidResult : r.fail(`Invalid connectionId`)
  )

  const result = await r.mapAsync(
    connectionValidationResult,
    (ctx) => saml.generateAssertion({ connection: ctx.b, user: { email: ctx.a.email, } }))

  if (r.isOk(result)) {
    return c.html(html.Assertion({ ...result.value, nonce: c.var.nonce }))
  }
  else {
    console.log(`IdP Error generating assertion: ${result.message}`)
    return errorResult(c, result)
  }
})

export default app
