import { Hono } from "hono"
import { sayHello } from "common"
import * as r from "common/result"

const app = new Hono()
app.get('/', (c) => c.text(JSON.stringify(r.map(r.from("a"), sayHello))))

export default app
