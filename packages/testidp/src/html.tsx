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
                  <h1 class="title">IdP Home</h1>
                  <p>Welcome <strong>{props.username}</strong>!</p>
                  <p>
                      You are now authenticated with the identity provider.
                  </p>
              </div>
              <div class="block">
                  <a class="button is-primary" href="/logout">Logout</a>
              </div>
          </section>
      </div>
  </Layout>
)

export const Login = (props: { siteData: SiteData, redirectTo: string }) => (
  <Layout {...props.siteData }>
      <div class="container">
          <section class="section">
              <h1 class="title">IdP Login</h1>
              <p>
                  This is the Identity provider login page. In a real system the credentials entered below
                  would be validated, but this test IdP allows you to enter any email for the username.
                  It performs no validation or checks of any kind.
              </p>
              <form action="/login" method="post">
                  <div class="field">
                      <label class="label" for="username">Email:</label>
                      <input class="input" type="text" id="username" name="username" required></input>
                  </div>
                  <input type="hidden" id="redirect_to" name="redirect_to" value={props.redirectTo}></input>
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

export const Assertion = (props: {
  acsUrl: string,
  assertion: string,
  relayState: string,
}) =>
  html`
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>IdP Assertion</title>
  </head>
  <body>
      <section class="section">
          <div class="container">
              <h1 class="title">IdP Assertion</h1>
              <form id="assertion-form" method="post" action="${props.acsUrl}" ...>
                <input type="hidden" name="SAMLResponse" value="${props.assertion}" />
                <input type="hidden" name="RelayState" value="${props.relayState}" />
                <input class="button" type="submit" value="Submit" />
              </form>
          </div>
      </section>
  </body>
  <script lang="ecmascript">
    // auto form submission
    const myForm = document.getElementById("assertion-form");
    myForm.submit();
  </script>
  </html>
  `
