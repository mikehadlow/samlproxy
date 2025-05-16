import * as samlify from "samlify"
import * as r from "./result"

// This file declares two entities, an idpConnection, and an spConnection.

// An idpConnection encapsulates an SP's connection to an IdP. So it is responsible
// for creating the intial SP-initiated AuthnRequest, and also for consuming
// the Assertion returned by the IdP at the Assertion Consumer Service endpoint.
export type IdpConnection = {
  // SP (my) properties
  spEntityId: string,
  spAcsUrl: string,
  // IdP (their) properties
  idpEntityId: string,
  idpSsoUrl: string,
  cert: string,
}

// An spConnection encapsulates an IdP's connection to an SP. So it is responsible
// for consuming an SP-initiated AuthnRequest, authenticating the principle, and
// constructing and signing the assertion.
export type SpConnection = {
  // IdP (my) properties
  idpEntityId: string,
  idpSsoUrl: string,
  cert: string,
  // SP (their) properties
  spEntityId: string,
  spAcsUrl: string,
}

export type AuthnRequest = {
  url: string,
}

export type AuthnRequestDetails = {
  id: string,
  issuer: string,
  acsUrl: string,
  ssoUrl: string,
  issueInstant: Date
}

// TODO: setup schema validator
samlify.setSchemaValidator({
  validate: (_response: string) => {
    // Just skip validation for now
    return Promise.resolve('skipped');
  }
})

// Generates a SAML AuthnRequest URL from the given IdPConnection with the given relayState
// Assumes redirect binding
export const generateAuthnRequest = (args: { connection: IdpConnection, relayState: string }): AuthnRequest => {
  const connection = args.connection
  const relayState = args.relayState
  const sp = samlify.ServiceProvider({
    entityID: connection.spEntityId,
    relayState,
    assertionConsumerService: [{
      Binding: samlify.Constants.BindingNamespace.Post,
      Location: connection.spAcsUrl,
    }]
  })
  const idp = samlify.IdentityProvider({
    entityID: connection.idpEntityId,
    singleSignOnService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
    // Samlify expects this even though we don't need it here.
    singleLogoutService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
  })
  const { context } = sp.createLoginRequest(idp, 'redirect')
  return {
    url: context,
  }
}

export const parseAuthnRequest = (args: { authnRequest: string }): r.Result<AuthnRequestDetails> => {
  try {
    const authnRequest = args.authnRequest
    const xml = samlify.Utility.inflateString(authnRequest)
    const properties = samlify.Extractor.extract(xml, samlify.Extractor.loginRequestFields)
    if (typeof properties.issuer !== "string" ||
      typeof properties.request !== "object" ||
      typeof properties.request.id !== "string" ||
      typeof properties.request.assertionConsumerServiceUrl !== "string" ||
      typeof properties.request.destination !== "string" ||
      typeof properties.request.issueInstant !== "string") {
      return r.fail("Malformed AuthnRequest")
    }
    return r.from({
      id: properties.request.id,
      issuer: properties.issuer,
      acsUrl: properties.request.assertionConsumerServiceUrl,
      ssoUrl: properties.request.destination,
      issueInstant: new Date(properties.request.issueInstant),
    })
  }
  catch (e) {
    return r.fail("Malformed AuthnRequest")
  }
}
