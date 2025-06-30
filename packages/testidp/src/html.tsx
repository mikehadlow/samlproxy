import { html } from 'hono/html'
import type { SpConnection } from 'common/saml'
import type { UserConnection } from './entity'

export type SiteData = {
  title: string,
  nonce: string,
  children?: any,
}

const Layout = (props: SiteData) =>
  html`<!DOCTYPE html>
    <html class="theme-dark">
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

export const Home = (props: {
  siteData: SiteData,
  username: string,
  connections: SpConnection[],
}) => {
  const connectionList = props.connections.map(connection => (
    <li key={connection.id}>
      <a className="cell box has-background-info-dark" href={ `/idp/iif/${connection.id}`}>{connection.name}</a>
    </li>
  ))
  return (
    <Layout {...props.siteData }>
        <div className="container">
            <section className="section column is-8">
                <div className="block">
                    <h1 className="title">IdP Home</h1>
                    <p>Welcome <strong>{props.username}</strong>!</p>
                    <p>
                        You are now authenticated with the identity provider.
                    </p>
                </div>
                <div className="box">
                    <h2 className="subtitle">Connections</h2>
                    <p className="block">Click on a connection to login with IdP initiated SSO.</p>
                    <ul className="grid">
                        {connectionList}
                    </ul>
                </div>
                <div className="block">
                    <a className="button is-primary" href="/logout">Logout</a>
                </div>
            </section>
        </div>
    </Layout>
  )
}

export const Login = (props: { siteData: SiteData, redirectTo: string, userConnections: UserConnection[] }) => {
  const userConnectionList = props.userConnections.map(user => (
    <tr>
      <td>{ user.email }</td>
      <td>{ user.name }</td>
    </tr>
  ))
  return (
    <Layout {...props.siteData}>
      <div className="container">
        <section className="section column is-half">
          <h1 className="title">IdP Login</h1>
          <p className="block">
            This is the Identity provider login page. In a real system the credentials entered below
            would be validated, but this test IdP doesn't require credientials, simply a valid email address
            from the list given.
          </p>
          <div className="block">
            <table className="table">
              {userConnectionList}
            </table>
          </div>
          <form className="box" action="/login" method="post">
            <div className="field">
              <label className="label" htmlFor="username">Email:</label>
              <input className="input" type="text" id="username" name="username" required></input>
            </div>
            <input type="hidden" id="redirect_to" name="redirect_to" value={props.redirectTo}></input>
            <div className="field">
              <input className="button is-primary" type="submit" value="Login"></input>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  )
}

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
        <div class="container">
            <svg id="svg">
                <text
                    class="logo"
                    x="50%"
                    y="50%"
                    text-anchor="middle"
                    dominant-baseline="middle"
                >
                    IdP
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
    </div>
  </body>
  <script lang="ecmascript" nonce="${props.nonce}" src="/js/animation.js"></script>
  <script lang="ecmascript" nonce="${props.nonce}" src="/js/auto-form-submission.js"></script>
  </html>
  `
