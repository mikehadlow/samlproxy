import { Hono, type Context } from "hono"
import { serveStatic } from "hono/bun"
import { logger } from 'hono/logger'
import { cspMiddleware, type ContextWithNonce } from "common/hono"
import * as r from "common/result"
import * as saml from "common/saml"
import { getSpConnection, getIdpConnection } from "common/db"
import {
  initDb,
  recordRelayState,
  consumeRelayState,
  getLinkedSpEntityId,
  getLinkedIdpEntityId,
} from "./db"
import * as html from "./html"
import * as z from "zod"

const authnRequest = z.object({
  SAMLRequest: z.string(),
  RelayState: z.string(),
})

const assertionForm = z.object({
  SAMLResponse: z.string(),
  RelayState: z.string(),
})

const con = initDb()

const siteData = (title: string, nonce: string): html.SiteData => ({ title, nonce })

const app = new Hono<ContextWithNonce>()
app.use(logger())
app.use("/js/*", serveStatic({ root: "./static" }))
app.use("/css/*", serveStatic({ root: "./static" }))
app.use(cspMiddleware())

const errorResult = (c: Context, fail: r.Fail) => {
  const errorProps = (typeof fail.message === "string")
    ? {
      status: 401,
      title: "Not Authenticated",
      message: fail.message
    } as const
    : {
      status: 500,
      title: "Internal Server Error",
      message: "Oh dear, a bug. See logs for details.",
    } as const
  const props = {
    siteData: {
      title: "SP Error",
      nonce: c.var["nonce"]
    },
    ... errorProps,
  }
  c.status(props.status)
  return c.html(html.Error(props).toString())
}

app.get("/", async (c) => {
  return c.html(html.Home({ siteData: siteData("Proxy", c.var["nonce"] ) }).toString())
})

app.get("/proxy/sso", async (c) => {
  const requestResult = r.attempt(() => authnRequest.parse(c.req.query()))

  const parseResult = r.bind(requestResult,
    (request) => saml.parseAuthnRequest({ authnRequest: request.SAMLRequest }))

  const spConnectionResult = r.bind(parseResult,
    (request) => getSpConnection(con, { spEntityId: request.issuer }))

  const validationResult = r.validate(r.merge2(parseResult, spConnectionResult),
    (ctx) => saml.validateAuthnRequest({ connection: ctx.b, details: ctx.a }))

  // Now that we've validated the AuthnRequest from the SP, we create a new
  // AuthnRequest from the proxy to the upstream IdP
  const linkResult = r.bind(validationResult,
    (ctx) => getLinkedIdpEntityId(con, { spEntityId: ctx.b.spEntityId }))
  const idpConnectionResult = r.bind(linkResult,
    (link) => getIdpConnection(con, { idpEntityId: link.idpEntityId }))

  const aunthnRequestResult = r.map(
    r.merge3(idpConnectionResult, requestResult, parseResult),
    (ctx) => {
      const request = saml.generateAuthnRequest({ connection: ctx.a, relayState: ctx.b.RelayState })
      // record the relaystate and SP entityId in the db
      recordRelayState(con, {
        relayState: ctx.b.RelayState,
        spRequestId: ctx.c.id,
        proxyRequestId: request.id,
        spEntityId: ctx.a.spEntityId,
      })
      return request
    })

  if (r.isOk(aunthnRequestResult)) {
    // finally redirect to the upstream IdP
    return c.redirect(aunthnRequestResult.value.url)
  }
  return errorResult(c, aunthnRequestResult)
})

app.post("/proxy/acs", async (c) => {
  const body = await c.req.parseBody()
  const formResult = r.attempt(() => assertionForm.parse(body))
  const assertionExtractResult = r.map(formResult, (form) => saml.parseAssertion(form.SAMLResponse))

  const idpConnectionResult = r.bind(
    assertionExtractResult,
    (assertionExtract) => getIdpConnection(con, { idpEntityId: assertionExtract.issuer }))

  // validate the relayState
  const relayStateResult = r.bind(formResult, (form) => consumeRelayState(con, { relayState: form.RelayState }))
  const validateRelayStateResult = r.validate(
    r.merge3(formResult, idpConnectionResult, assertionExtractResult),
    (ctx) => {
      // if no relayState is given, assume an IdP-iniitated request
      if (!ctx.a.RelayState) {
        // confirm that the assertion does not have an inResponseTo id set.
        if (ctx.c.inResponseTo !== undefined) {
          return r.fail("An IdP initiated request must not have an inResponseTo id set.")
        }
        if (!ctx.b.spAllowIdpInitiated) {
          return r.fail("This connection does not allow IdP-initiated requests.")
        }
        return r.voidResult // success
      }
      return r.bind(
        relayStateResult,
        (relayState) => {
          if (relayState.sp_entity_id !== ctx.b.spEntityId) {
            return r.fail(`SP Error invalid spEntityId: expected: ${relayState.sp_entity_id}, got: ${ctx.b.spEntityId}`)
          }
          if (relayState.proxy_request_id !== ctx.c.inResponseTo) {
            return r.fail(`SP Error invalid requestId: expected: ${relayState.proxy_request_id}, got: ${ctx.c.inResponseTo}`)
          }
          return r.voidResult // success
        }
      )
    })

  // validate the assertion certificate etc
  const validateAssertionResult = await r.validateAsync(
    r.merge3(validateRelayStateResult, formResult, idpConnectionResult),
    (ctx) => saml.validateAssertion({ connection: ctx.c, encodedAssertion: ctx.b.SAMLResponse }))

  // We've successfully validated the SAML Assertion, so now we can issue a new Assesrtion
  // for the downstream SP
  const linkResult = r.bind(
    idpConnectionResult,
    (connection) => getLinkedSpEntityId(con, { idpEntityId: connection.idpEntityId }))

  const spConnectionResult = r.bind(
    r.merge2(validateAssertionResult, linkResult),
    (ctx) => getSpConnection(con, { spEntityId: ctx.b.spEntityId }))

  const assertionProps = r.bind(
    r.merge3(spConnectionResult, formResult, assertionExtractResult),
    (ctx) => {
      if (ctx.b.RelayState) {
        return r.map(relayStateResult, (rs) => {
          return {
            user: {
              email: ctx.c.nameID,
            },
            relayState: ctx.b.RelayState,
            requestId: rs.sp_request_id,
          }
        })
      }
      return r.from({
        user: {
          email: ctx.c.nameID,
        },
      })
  })

  const result = await r.mapAsync(
    r.merge2(spConnectionResult, assertionProps),
    (ctx) =>   saml.generateAssertion({ connection: ctx.a, ...ctx.b }))

  if (r.isOk(result)) {
    return c.html(html.Assertion({ ...result.value, nonce: c.var["nonce"] }))
  }
  else {
    console.log(`IdP Error validating authnRequest: ${result.message}`)
    return errorResult(c, result)
  }
})

app.notFound((c) => {
  const props = {
    siteData: {
      title: "Not Found",
      nonce: c.var["nonce"],
    },
    status: 404,
    title: "Not Found",
    message: "There's nothing to see here, move along please."
  } as const
  c.status(props.status)
  return c.html(html.Error(props).toString())
})

export default app
