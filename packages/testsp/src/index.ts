import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"
import * as saml from "common/saml"
import { z } from "zod"

const connection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: "http://localhost:7282/test-sp",
  spAcsUrl: "http://localhost:7282/acs",
  // IdP (their) properties
  idpEntityId: "http://localhost:7292/test-idp",
  idpSsoUrl: "http://localhost:7292/sso",
  signingCertificate: "",
}

const loginForm = z.object({
  username: z.string().email(),
})

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
  // at this point we would use the entered email address to choose
  // the IdP which we want to use to authenticate the user
  // but now simply redirect to the test IdP
  const relayState = `rs-${crypto.randomUUID()}`
  const result = saml.generateAuthnRequest({ connection, relayState })
  return c.redirect(result.url)
})

app.post("/acs", (c) => {
  // TODO validate SAML assertion
  return c.text("Logged in")
})

export default app
