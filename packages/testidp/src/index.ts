import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"
import * as saml from "common/saml"
import { z } from "zod/v4"
import Mustache from "mustache"
import * as jwt from "jsonwebtoken"
import { setCookie, getCookie, deleteCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'

// html imports
import homeHtml from "./html/home.html"
import loginHtml from "./html/login.html"
import assertionHtml from "./html/assertion.html"

const loginForm = z.object({
  username: z.string().email(),
  password: z.string(),
  redirect_to: z.string(),
})

const authnRequest = z.object({
  SAMLRequest: z.string(),
  RelayState: z.string(),
})

const encryptKey: string = fs.readFileSync(path.join(__dirname, "keys", "encryptKey.pem"), "utf8")
const encryptionCert: string = fs.readFileSync(path.join(__dirname, "keys", "encryptionCert.cer"), "utf8")

const connection: saml.SpConnection = {
  // IdP (my) properties
  idpEntityId: "http://localhost:7292/test-idp",
  idpSsoUrl: "http://localhost:7292/sso",
  privateKey: encryptKey,
  privateKeyPassword: "foobar",
  signingCertificate: encryptionCert,
  // SP (their) properties
  spEntityId: "http://localhost:7282/test-sp",
  spAcsUrl: "http://localhost:7282/acs",
}

const session = z.object({
  username: z.string().email()
})
type Session = z.infer<typeof session>

const env = {
  jwtSecret: process.env["TEST_IDP_JWT_SECRET"] ?? ""
}

const authCookieName = "idp_auth"
const redirectQueryParam = "redirect_to"

const app = new Hono()
app.use(logger())

const authMiddleware = createMiddleware <{ Variables: { session: Session } }> (async (c, next) => {
  // don't authenticate the login path
  if (c.req.path === "/login") {
    await next()
  }
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
app.use(authMiddleware)

app.get("/", authMiddleware, async (c) => {
  const html = Mustache.render(homeHtml, c.var.session)
  return c.html(html)
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const redirectTo = c.req.query(redirectQueryParam) ?? "/"
  const html = Mustache.render(loginHtml, { redirectTo })
  return c.html(html)
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const login = loginForm.parse(body)

  // TODO: validate the email and password

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
  const request = authnRequest.parse(c.req.query())
  console.log("SAMLRequest", request.SAMLRequest)
  console.log("RelayState", request.RelayState)

  // TODO: Validate the AuthnRequest

  const user: saml.User = {
    email: c.var.session.username
  }
  const relayState = request.RelayState
  const requestId = `_${crypto.randomUUID()}`

  const result = await saml.generateAssertion({ connection, requestId, relayState, user })

  const html = Mustache.render(assertionHtml, result)
  return c.html(html)
})

export default app
