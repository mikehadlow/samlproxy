import { Hono, type Context } from "hono"
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

const siteData = (title: string): html.SiteData => ({ title })

const app = new Hono()

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
    },
    ... errorProps,
  }
  c.status(props.status)
  return c.html(html.Error(props))
}

app.get("/", async (c) => {
  return c.html(html.Home({ siteData: siteData("IdP Home") }))
})

app.get("/sso", async (c) => {
  const requestResult = r.attempt(() => authnRequest.parse(c.req.query()))

  const parseResult = r.bind(requestResult,
    (request) => saml.parseAuthnRequest({ authnRequest: request.SAMLRequest }))

  const spConnectionResult = r.bind(parseResult,
    (request) => getSpConnection(con, { spEntityId: request.issuer }))

  const ctx1 = r.merge2(parseResult, spConnectionResult)
  const validationResult = r.validate(ctx1,
    (ctx) => saml.validateAuthnRequest({ connection: ctx.b, details: ctx.a }))

  // Now that we've validated the AuthnRequest from the SP, we create a new
  // AuthnRequest from the proxy to the upstream IdP
  const linkResult = r.bind(validationResult,
    (ctx) => getLinkedIdpEntityId(con, { spEntityId: ctx.b.spEntityId }))
  const idpConnectionResult = r.bind(linkResult,
    (link) => getIdpConnection(con, { idpEntityId: link.idpEntityId }))

  const aunthnRequestResult = r.map(idpConnectionResult,
    (connection) => {
      // record the relaystate and email in the db
      const relayState = `rs-${crypto.randomUUID()}`
      r.run(linkResult, (link) => {
        recordRelayState(con, {
          relayState,
          spEntityId: link.spEntityId,
        })
      })
      return saml.generateAuthnRequest({ connection, relayState })
    })

  if (r.isOk(aunthnRequestResult)) {
    // finally redirect to the upstream IdP
    return c.redirect(aunthnRequestResult.value.url)
  }
  return errorResult(c, aunthnRequestResult)
})

app.post("/acs", async (c) => {
  const body = await c.req.parseBody()
  const formResult = r.attempt(() => assertionForm.parse(body))
  const assertionExtractResult = r.map(formResult, (form) => saml.parseAssertion(form.SAMLResponse))

  const idpConnectionResult = r.bind(
    assertionExtractResult,
    (assertionExtract) => getIdpConnection(con, { idpEntityId: assertionExtract.issuer }))

  const linkResult = r.bind(idpConnectionResult,
    (connection) => getLinkedSpEntityId(con,{ idpEntityId: connection.idpEntityId }))

  // validate the relayState
  let ctx1 = r.merge2(formResult, linkResult)
  ctx1 = r.validate(ctx1, (ctx) => {
    const relayStateResult = consumeRelayState(con, { relayState: ctx.a.RelayState })
    return r.bind(
      relayStateResult,
      (relayState) => relayState.sp_entity_id === ctx.b.spEntityId
        ? r.voidResult
        : r.fail(`SP Error invalid spEntityId: expected: ${relayState.sp_entity_id}, got: ${ctx.b.spEntityId}`)
    )
  })

  // validate the assertion certificate etc
  let ctx2 = r.merge3(ctx1, formResult, idpConnectionResult)
  ctx2 = await r.validateAsync(
    ctx2,
    (ctx) => saml.validateAssertion({ connection: ctx.c, encodedAssertion: ctx.b.SAMLResponse }))

  // We've successfully validated the SAML Assertion, so now we can issue a new Assesrtion
  // for the downstream SP
  const ctx3 = r.merge2(ctx2, linkResult)
  const spConnectionResult = r.bind(ctx3,
    (ctx) => getSpConnection(con, { spEntityId: ctx.b.spEntityId }))

  const ctx4 = r.merge3(ctx3, formResult, assertionExtractResult)
  const assertionProps = r.map(ctx4,
    (ctx) => ({
    user: {
      email: ctx.c.nameID,
    },
    relayState: ctx.b.RelayState,
    requestId: ctx.c.id,
  }))

  const ctx5 = r.merge2(spConnectionResult, assertionProps)
  const result = await r.mapAsync(ctx5,
    (ctx) =>   saml.generateAssertion({ connection: ctx.a, ...ctx.b }))

  if (r.isOk(result)) {
    return c.html(html.Assertion(result.value))
  }
  else {
    console.log(`IdP Error validating authnRequest: ${result.message}`)
    return errorResult(c, result)
  }
})

app.notFound((c) => {
  const props = {
    siteData: {
      title: "Not Found"
    },
    status: 404,
    title: "Not Found",
    message: "There's nothing to see here, move along please."
  } as const
  c.status(props.status)
  return c.html(html.Error(props))
})

export default app
