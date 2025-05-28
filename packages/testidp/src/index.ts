import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"
import * as saml from "common/saml"
import { z } from "zod/v4"
import Mustache from "mustache"

const loginForm = z.object({
  username: z.string().email(),
  password: z.string(),
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

const app = new Hono()
app.use(logger())

app.get("/", (c) => c.redirect("/login"))

app.get("/login", (c) => {
  const html = fs.readFileSync(path.join(__dirname, "html", "login.html"), "utf8")
  return c.html(html)
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  const login = loginForm.parse(body)
  console.log("login.username", login.username)
  // TODO, set JWT
  return c.text("Logged in")
})

app.get("/sso", async (c) => {
  const request = authnRequest.parse(c.req.query())
  console.log("SAMLRequest", request.SAMLRequest)
  console.log("RelayState", request.RelayState)

  // TODO: Validate the AuthnRequest

  const user: saml.User = {
    email: "me@mikehadlow.com"
  }
  const relayState = request.RelayState
  const requestId = `_${crypto.randomUUID()}`

  const result = await saml.generateAssertion({ connection, requestId, relayState, user })

  const assertionTemplate = fs.readFileSync(path.join(__dirname, "html", "assertion.html"), "utf8")
  const html = Mustache.render(assertionTemplate, result)
  return c.html(html)
})

export default app
