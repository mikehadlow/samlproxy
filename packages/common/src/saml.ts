import * as samlify from "samlify"
import * as r from "./result"
import * as template from "./template"
import * as e from "./entity"
import * as assertion from "./assertion"

// TODO: setup schema validator
samlify.setSchemaValidator({
  validate: (_response: string) => {
    // Just skip validation for now
    return Promise.resolve('skipped');
  }
})

// Generates a SAML AuthnRequest URL from the given IdPConnection with the given relayState
// Assumes redirect binding
export const generateAuthnRequest = (args: { connection: e.IdpConnection, relayState: string }): e.AuthnRequest => {
  const {
    connection,
    relayState,
  } = args
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

export const parseAuthnRequest = (args: { authnRequest: string }): r.Result<e.AuthnRequestDetails> => {
  try {
    const { authnRequest } = args
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

export const generateAssertion = async (args: {
    connection: e.SpConnection,
    requestId: string,
    relayState: string,
    user: e.User,
  }): Promise<e.Assertion> => {
  const {
    connection,
    relayState,
    requestId,
    user,
  } = args
  const sp = samlify.ServiceProvider({
    entityID: connection.spEntityId,
    relayState,
    // signingCert: connection.signingCertificate,
    // wantAssertionsSigned: true,
    // wantMessageSigned: true,
    assertionConsumerService: [{
      Binding: samlify.Constants.BindingNamespace.Post,
      Location: connection.spAcsUrl,
    }]
  })
  const idp = samlify.IdentityProvider({
    entityID: connection.idpEntityId,
    privateKey: connection.privateKey,
    privateKeyPass: connection.privateKeyPassword,
    signingCert: connection.signingCertificate,
    isAssertionEncrypted: false,
    singleSignOnService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
    // Samlify expects this even though we don't need it here.
    singleLogoutService: [{
      Binding: samlify.Constants.BindingNamespace.Redirect,
      Location: connection.idpSsoUrl,
    }],
    loginResponseTemplate: {
      context: template.assertionTemplate,
      attributes: [],
    },
  })
  const { id, context } = await idp.createLoginResponse(
    sp,
    { extract: { request: { id: requestId } } }, // request info
    'post', // binding
    user,
    assertion.createTemplateCallback(connection, user, requestId),
    false, // encryptThenSign
    relayState
  )
  return {
    id,
    assertion: context,
    acsUrl: connection.spAcsUrl,
    relayState,
  }
}
