import { html } from 'hono/html'

export type SiteData = {
  title: string,
  nonce: string
  children?: any,
}

const Layout = (props: SiteData) =>
  html`<!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${props.title}</title>
        <link rel="stylesheet" nonce="${props.nonce}" href="https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css">
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
  relayState?: string,
  nonce: string,
}) =>
  html`
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>IdP Assertion</title>
      <link rel="stylesheet" nonce="${props.nonce}" href="/css/assertion.css">
  </head>
  <body>
          <div className="form-container">
              <form id="assertion-form" hidden method="post" action="${props.acsUrl}" ...>
                <input type="hidden" name="SAMLResponse" value="${props.assertion}" />
                <input type="hidden" name="RelayState" value="${props.relayState}" />
                <input className="button" type="submit" value="Submit" />
              </form>
          </div>

      <div class="container">
          <svg id="svg">
              <text
                  class="logo"
                  x="50%"
                  y="50%"
                  text-anchor="middle"
                  dominant-baseline="middle"
              >
                  Proxy
              </text>
              <g id="innerCircle">
                  <animateTransform
                      attributeName="transform"
                      begin="0s"
                      dur="10s"
                      type="rotate"
                      from="0 250 250"
                      to="360 250 250"
                      repeatCount="indefinite"
                  />
              </g>
              <g id="outerCircle">
                  <animateTransform
                      attributeName="transform"
                      begin="0s"
                      dur="10s"
                      type="rotate"
                      from="360 250 250"
                      to="0 250 250"
                      repeatCount="indefinite"
                  />
              </g>
          </svg>
      </div>
  </body>
  <script lang="ecmascript" nonce="${props.nonce}" src="/js/animation.js"></script>
  <script lang="ecmascript" nonce="${props.nonce}" src="/js/auto-form-submission.js"></script>
  </html>
  `
