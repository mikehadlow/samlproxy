import { html } from 'hono/html'

export type SiteData = {
  title: string,
  children?: any,
}

const Layout = (props: SiteData) =>
  html`<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${props.title}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css">
    </head>
    <body>
        ${props.children}
    </body>
    </html>`

export const Home = (props: { siteData: SiteData, username: string }) => (
  <Layout {...props.siteData }>
      <div class="container">
          <section class="section">
              <div class="block">
                  <h1 class="title">SP Home</h1>
                  <p>Welcome <strong>{props.username}</strong>!</p>
                  <p>
                      You are now authenticated with the service provider.
                  </p>
              </div>
              <div class="block">
                  <a class="button is-primary" href="/logout">Logout</a>
              </div>
          </section>
      </div>
  </Layout>
)

export const Login = (props: { siteData: SiteData }) => (
  <Layout {...props.siteData }>
      <div class="container">
          <section class="section">
              <h1 class="title">SP Login</h1>
              <form action="/login" method="post">
                  <div class="field">
                      <label class="label" for="username">Email:</label>
                      <input class="input" type="text" id="username" name="username" required></input>
                  </div>
                  <div class="field">
                      <input class="button is-primary" type="submit" value="Login"></input>
                  </div>
              </form>
          </section>
      </div>
  </Layout>
)

export const Error = (props: {
  siteData: SiteData,
  status: number,
  title: string,
  message: string }) => (
  <Layout {...props.siteData }>
      <div class="container">
          <section class="section">
              <div class="block">
                  <h1 class="title">{props.status} {props.title}</h1>
                  <p>{props.message}</p>
              </div>
              <div class="block">
                  <a class="button is-primary" href="/">Home</a>
              </div>
          </section>
      </div>
  </Layout>
)
