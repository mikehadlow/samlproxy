import { Hono, type Context } from "hono"
import * as r from "common/result"
import { initDb } from "./db"
import * as html from "./html"

const con = initDb()

const siteData = (title: string): html.SiteData => ({ title })

const app = new Hono()

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
  return c.html(html.Error(props))
}

app.get("/", async (c) => {
  return c.html(html.Home({ siteData: siteData("IdP Home") }))
})

export default app
