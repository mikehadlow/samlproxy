import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"
import * as saml from "common/saml"

const app = new Hono()
app.use(logger())

app.get("/", (c) => c.redirect("/login"))

app.get("/login", (c) => {
  const html = fs.readFileSync(path.join(__dirname, "html", "login.html"), "utf8")
  return c.html(html)
})

app.post("/login", async (c) => {
  const body = await c.req.parseBody()
  console.log(JSON.stringify(body, null, 2))
  return c.text("Logged in!")
})

export default app
