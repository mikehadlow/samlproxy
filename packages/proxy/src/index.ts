import { Hono } from "hono"
import { sayHello } from "common"

const app = new Hono()
app.get('/', (c) => c.text(sayHello()))

export default app
