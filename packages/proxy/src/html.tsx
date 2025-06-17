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

export const Home = (props: { siteData: SiteData }) => (
  <Layout {...props.siteData }>
      <div className="container">
          <section className="section">
              <div className="block">
                  <h1 className="title">SAML Proxy</h1>
                  <p>Welcome to SAML Proxy.</p>
                  <p>
                      There's nothing to see here at root.
                  </p>
              </div>
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
      <div className="container">
          <section className="section">
              <div className="block">
                  <h1 className="title">{props.status} {props.title}</h1>
                  <p>{props.message}</p>
              </div>
              <div className="block">
                  <a className="button is-primary" href="/">Home</a>
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
      <section className="section">
          <div className="container">
              <h1 className="title">IdP Assertion</h1>
              <form id="assertion-form" method="post" action="${props.acsUrl}" ...>
                <input type="hidden" name="SAMLResponse" value="${props.assertion}" />
                <input type="hidden" name="RelayState" value="${props.relayState}" />
                <input className="button" type="submit" value="Submit" />
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
