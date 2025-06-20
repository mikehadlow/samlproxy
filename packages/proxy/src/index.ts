import { Hono, type Context } from "hono"
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
    r.merge2(idpConnectionResult, requestResult),
    (ctx) => {
      // record the relaystate and SP entityId in the db
      recordRelayState(con, {
        relayState: ctx.b.RelayState,
        spEntityId: ctx.a.spEntityId,
      })
      return saml.generateAuthnRequest({ connection: ctx.a, relayState: ctx.b.RelayState })
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
  const validateRelayStateResult = r.validate(
    r.merge2(formResult, idpConnectionResult),
    (ctx) => {
      const relayStateResult = consumeRelayState(con, { relayState: ctx.a.RelayState })
      return r.bind(
        relayStateResult,
        (relayState) => relayState.sp_entity_id === ctx.b.spEntityId
          ? r.voidResult
          : r.fail(`SP Error invalid spEntityId: expected: ${relayState.sp_entity_id}, got: ${ctx.b.spEntityId}`)
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
    (connection) => getLinkedSpEntityId(con,{ idpEntityId: connection.idpEntityId }))

  const spConnectionResult = r.bind(
    r.merge2(validateAssertionResult, linkResult),
    (ctx) => getSpConnection(con, { spEntityId: ctx.b.spEntityId }))

  const assertionProps = r.map(
    r.merge3(spConnectionResult, formResult, assertionExtractResult),
    (ctx) => ({
    user: {
      email: ctx.c.nameID,
    },
    relayState: ctx.b.RelayState,
    requestId: ctx.c.id,
  }))

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

app.get("/auto-form-submission.js", (c) => {
  c.header("Content-Type", "text/javascript")
  return c.text(`
    const myForm = document.getElementById("assertion-form");
    myForm.submit();
    `)
})

export default app
