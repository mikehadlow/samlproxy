import { html } from 'hono/html'
import { type UserConnection } from './entity'

export type SiteData = {
  title: string,
  nonce: string,
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

export const Home = (props: { siteData: SiteData, username: string }) => (
  <Layout {...props.siteData }>
      <div className="container">
          <section className="section">
              <div className="block">
                  <h1 className="title">SP Home</h1>
                  <p>Welcome <strong>{props.username}</strong>!</p>
                  <p>
                      You are now authenticated with the service provider.
                  </p>
              </div>
              <div className="block">
                  <a className="button is-primary" href="/logout">Logout</a>
              </div>
          </section>
      </div>
  </Layout>
)

export const Login = (props: { siteData: SiteData, testIdpUrl: string, userConnections: UserConnection[]}) => {
  const userConnectionList = props.userConnections.map(user => (
    <tr>
      <td>{ user.email }</td>
      <td>{ user.name }</td>
    </tr>
  ))
  return (
  <Layout {...props.siteData }>
      <div className="container">
          <section className="section column is-6">
              <h1 className="title">SP Login</h1>
              <p className="block">
                Login as one of the users below to test the SP login flow, either directly to the IdP, or via the SAML Proxy.
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
                  <div className="field">
                      <input className="button is-primary" type="submit" value="Login"></input>
                  </div>
              </form>
              <div className="block">
                <a href={props.testIdpUrl}>Or login to the IdP first for IdP initiated flow.</a>
              </div>
          </section>
      </div>
  </Layout>
) }

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
