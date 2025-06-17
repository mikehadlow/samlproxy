import { getSpConnection } from "common/db"
import * as r from "common/result"
import * as saml from "common/saml"
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import * as jwt from "jsonwebtoken"
import { z } from "zod/v4"
import { initDb } from "./db"
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
const siteData = (title: string): html.SiteData => ({ title })

const env = z.object({
  jwtSecret: z.string().min(32),
}).parse({
  jwtSecret: process.env["TEST_IDP_JWT_SECRET"],
})

const con = initDb()
const app = new Hono()
app.use(logger())

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
    },
    ... errorProps,
  }
  c.status(props.status)
  return c.html(html.Error(props).toString())
}


app.get("/", authMiddleware, async (c) => {
  return c.html(html.Home({ siteData: siteData("IdP Home"), ...c.var.session }).toString())
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const redirectTo = c.req.query(redirectQueryParam) ?? "/"
  return c.html(html.Login({ siteData: siteData("IdP Login"), redirectTo }).toString())
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const login = loginForm.parse(body)

  // Here a real IdP would validate the user's credientials.
  // This test IdP accepts whatever is entered.

  // The user has authenticated, so now we can issue a JWT
  const session: Session = { username: login.username }
  const token = jwt.sign(session, env.jwtSecret, { expiresIn: '1h' })
  setCookie(c, authCookieName, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 1000, // 1h
    sameSite: "Lax",
  })
  return c.redirect(login.redirect_to)
})

app.get("/sso", authMiddleware, async (c) => {
  const requestResult = r.attempt(() => authnRequest.parse(c.req.query()))

  const parseResult = r.bind(requestResult,
    (request) => saml.parseAuthnRequest({ authnRequest: request.SAMLRequest }))

  // TODO: check that logged in user has access to the given connection

  const connectionResult = r.bind(parseResult,
    (request) => getSpConnection(con, { spEntityId: request.issuer }))

  const ctx1 = r.merge2(parseResult, connectionResult)
  const validationResult = r.validate(ctx1,
    (ctx) => saml.validateAuthnRequest({ connection: ctx.b, details: ctx.a }))

  const ctx2 = r.merge3(requestResult, parseResult, validationResult)
  const assertionProps = r.map(ctx2,
    (ctx) => ({
    user: {
      email: c.var.session.username
    },
    relayState: ctx.a.RelayState,
    requestId: ctx.b.id,
  }))

  const ctx3 = r.merge2(connectionResult, assertionProps)
  const result = await r.mapAsync(ctx3,
    (ctx) =>   saml.generateAssertion({ connection: ctx.a, ...ctx.b }))

  if (r.isOk(result)) {
    return c.html(html.Assertion(result.value))
  }
  else {
    console.log(`IdP Error validating authnRequest: ${result.message}`)
    return errorResult(c, result)
  }
})

export default app
