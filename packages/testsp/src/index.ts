import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"
import * as saml from "common/saml"
import { z } from "zod/v4"
import * as r from "common/result"
import * as jwt from "jsonwebtoken"
import { setCookie, getCookie, deleteCookie } from "hono/cookie"
import { createMiddleware } from 'hono/factory'
import Mustache from "mustache"
import * as db from "./db"

const connection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: "http://localhost:7282/test-sp",
  spAcsUrl: "http://localhost:7282/acs",
  // IdP (their) properties
  idpEntityId: "http://localhost:7292/test-idp",
  idpSsoUrl: "http://localhost:7292/sso",
  // certificate must match the IdP's certificate
  signingCertificate: `-----BEGIN CERTIFICATE-----
  MIIFazCCA1OgAwIBAgIUPxp5jOrtjfYSrKdoT4FWy51D93UwDQYJKoZIhvcNAQEL
  BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
  GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNTA1MjIxMTUwMTRaFw0zNTA1
  MjAxMTUwMTRaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
  HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggIiMA0GCSqGSIb3DQEB
  AQUAA4ICDwAwggIKAoICAQDcRA23hUPHSsVgUuXcMyDYnYrFUjbJsH44g5CLXtn8
  WDeo3iSxFaTwq6tbeA81bXM513L+FhcuW2IgAJ2sNcz092JLW9XxGRiLU3juCehm
  DEvqGYgMOGy6QRLG9IfebYwkakzJonHkdE5mk+ESgg8KJykjIJu7U61ANVcDuj0g
  wN6JrUqd0Bnrnrj7cGCNOr6Tcez+JAj/ROoxOaRB6kT/++7D/M+O49nZb+UTe6dc
  3J/xSEIiF5sUO/Kh8mNAtEFEyCwfPTxnL32PpGoG60i9zuOFhAPYJHoBXMdYlF8+
  m4/4IT86kcDF1FYyk79hWqUX+7oIDtPG0+TYrIZ589dmYoNHgSDcUWJV/diawiWg
  1vCrGBOEBDKsqk/npsrLgSVJED+yx3wM3M5Oe1+I7YtQQ03Z4LDk5HXZLJ4LvAfC
  f43KIXDWqL7zC+cWZKeXKmn7OZBI5w2YqwPTS1y0OJeYkPm4EV6cunnKtVhPPzhO
  Lqk7YiOoIf7tTNzjwyg1k594LNAzBQ501VHt0yY69GAsZKF+BBV3Skhb8BI6D+t6
  UBkFtx83TbWy0NbdKcTHuV7QKdWk698oxxp2cAO0TLMkd7yF6cPOKE/yeBHS41H2
  t3A3h8PvNJr2JY3FADEYmbWUMydmMbXSgIgV3TDHCEfp32bfBzMzNpUx/bKyOT/d
  9wIDAQABo1MwUTAdBgNVHQ4EFgQUWf076as3tYYTMoGBRHWN7jjVvuIwHwYDVR0j
  BBgwFoAUWf076as3tYYTMoGBRHWN7jjVvuIwDwYDVR0TAQH/BAUwAwEB/zANBgkq
  hkiG9w0BAQsFAAOCAgEAdlcTqVYNd8B2JbS5EicqpTobkTuGCLUfZAS5uhNmrLcY
  gnc97vDkJYPFKynTEW39KrH+MdL/GZAuMv2XxxTPDynfCW8MRlm37JtlNI66yb1B
  z9zyRISdpyTUa248iwCLzwgUyVFfGIeqCzcg8KjJQmD50Dj/Ush2yePKWKPui/tq
  smYspZenkGlwrTk6Wf1rUwMKIy3GNckKZ/J14teiej8Lk9CfwbVpGlOWoJWG6TSK
  +VybD7XXrhp3Lsvel5FYUTM+Hbtk7xxwkLjLVDyqsQpH6NH03YZaK/HZowsUfR/k
  YKI4APosP8Qy75kBleQF88Y+Jp+BYA1SuLt+5IAIipISh+KJmdvHOYRskOm5QcG7
  yAKs9PebFj8NaoSa/YNzIdz9HgNDC39g92u2WRjKrnE1fNnaHDunQX7C9GBFH9oM
  C+ld5sfgJM7iI3AI8ncYu2bJbFI24AWy7krjmq4jC9R0rNM66nHlbMcfoFLNtHwl
  FL9QQcaFBk752qVkxqHHvCfPfj3Ihw4PZV1MyVckKQrjDgxpFtQ+M7u48Enw5Sco
  IwcCOyy436Lf//f3NdRWduszRavJK7uPgtgHBnoqYtEh13LkybMRI+epVys4reFu
  dWSssB+v4QtZhhvlG2CScPDhtN910uzIX6YYD9CPWXU1ptNm8l9O8EVKdNloYlU=
  -----END CERTIFICATE-----`,
}

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
  const template = fs.readFileSync(path.join(__dirname, "html", "home.html"), "utf8")
  const html = Mustache.render(template, c.var.session)
  return c.html(html)
})

app.get("/logout", (c) => {
  deleteCookie(c, authCookieName)
  return c.redirect("/login")
})

app.get("/login", (c) => {
  const html = fs.readFileSync(path.join(__dirname, "html", "login.html"), "utf8")
  return c.html(html)
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
    (_) => saml.validateAssertion({ connection, encodedAssertion: form.SAMLResponse }))

  const result = r.map(assertionResult, (_) => {
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
    // Redirect to the homepage
    return c.redirect("/")
  }
  else {
    console.log(`SP Error validating assertion: ${result.message}`)
    return c.text("Login failed")
  }
})

export default app
