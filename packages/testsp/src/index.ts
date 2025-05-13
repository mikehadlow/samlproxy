import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello from the test SP!'))

export default app
