import * as r from "common/result"
import * as saml from "common/saml"
import * as fs from "fs"
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import { logger } from 'hono/logger'
import * as jwt from "jsonwebtoken"
import * as path from "path"
import { z } from "zod/v4"
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

const env = {
  jwtSecret: process.env["TEST_IDP_JWT_SECRET"] ?? ""
}

const readKey = (key:string) => fs.readFileSync(path.join(__dirname, "keys", key), "utf8")
const encryptKey = readKey("encryptKey.pem")
const encryptionCert = readKey("encryptionCert.cer")

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

const authCookieName = "idp_auth"
const redirectQueryParam = "redirect_to"
const siteData = (title: string): html.SiteData => ({ title })

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
  return c.html(html.Home({ siteData: siteData("IdP Home"), ...c.var.session }))
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const redirectTo = c.req.query(redirectQueryParam) ?? "/"
  return c.html(html.Login({ siteData: siteData("IdP Login"), redirectTo }))
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
  const request = authnRequest.parse(c.req.query())
  console.log("SAMLRequest", request.SAMLRequest)
  console.log("RelayState", request.RelayState)

  const parseResult = saml.parseAuthnRequest({ authnRequest: request.SAMLRequest })

  const validationResult = r.validate(parseResult, (details) => saml.validateAuthnRequest({ connection, details }))

  const assertionProps = r.map(validationResult, (authnReq) => ({
    user: {
      email: c.var.session.username
    },
    relayState: request.RelayState,
    requestId: authnReq.id,
  }))

  const result = await r.mapAsync(assertionProps, (props) =>   saml.generateAssertion({ connection, ...props }))

  if (r.isOk(result)) {
    return c.html(html.Assertion(result.value))
  }
  else {
    console.log(`IdP Error validating authnRequest: ${result.message}`)
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
        title: "IdP Error",
      },
      ... errorProps,
    }
    c.status(props.status)
    return c.html(html.Error(props))
  }
})

export default app
