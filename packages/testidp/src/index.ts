import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello from the test IdP!'))

export default app
