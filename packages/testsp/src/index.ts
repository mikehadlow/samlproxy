import { Hono } from 'hono'
import { logger } from 'hono/logger'
import * as fs from "fs"
import * as path from "path"

const app = new Hono()
app.use(logger())

app.get("/", (c) => c.redirect("/login"))

app.get("/login", (c) => {
  const html = fs.readFileSync(path.join(__dirname, "html", "login.html"), "utf8")
  return c.html(html)
})

export default app
