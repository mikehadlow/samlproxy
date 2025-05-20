import * as samlify from "samlify"
import * as r from "./result"
import * as crypto from "crypto"
import * as template from "./template"

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
  publicKey: string,
}

// An spConnection encapsulates an IdP's connection to an SP. So it is responsible
// for consuming an SP-initiated AuthnRequest, authenticating the principle, and
// constructing and signing the assertion.
export type SpConnection = {
  // IdP (my) properties
  idpEntityId: string,
  idpSsoUrl: string,
  privateKey: string,
  privateKeyPassword: string,
  signingCertificate: string,
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

export type Assertion = {
  id: string,
  assertion: string,
  acsUrl: string,
  relayState: string,
}

export type User = {
  email: string,
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

export const parseAuthnRequest = (args: { authnRequest: string }): r.Result<AuthnRequestDetails> => {
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
    connection: SpConnection,
    requestId: string,
    relayState: string,
    user: User,
  }): Promise<Assertion> => {
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
    createTemplateCallback(idp, sp, samlify.Constants.BindingNamespace.Post, user),
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

const createTemplateCallback = (
  idp: samlify.IdentityProviderInstance,
  sp: samlify.ServiceProviderInstance,
  binding: string,
  user: User
) => (template: string) => {
  const id =  '_8e8dc5f69a98cc4c1ff3427e5ce34606fd672f91e6';
  const now = new Date();
  const spEntityID = sp.entityMeta.getEntityID();
  const idpSetting = idp.entitySetting;
  const fiveMinutesLater = new Date(now.getTime());
  fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5);
  const tvalue = {
    ID: id,
    AssertionID: idpSetting.generateID ? idpSetting.generateID() : `${crypto.randomUUID()}`,
    Destination: sp.entityMeta.getAssertionConsumerService(binding),
    Audience: spEntityID,
    SubjectRecipient: spEntityID,
    NameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    NameID: user.email,
    Issuer: idp.entityMeta.getEntityID(),
    IssueInstant: now.toISOString(),
    ConditionsNotBefore: now.toISOString(),
    ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
    SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
    AssertionConsumerServiceURL: sp.entityMeta.getAssertionConsumerService(binding),
    EntityID: spEntityID,
    InResponseTo: '_4606cc1f427fa981e6ffd653ee8d6972fc5ce398c4',
    StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
    attrUserEmail: 'myemailassociatedwithsp@sp.com',
    attrUserName: 'mynameinsp',
  };
  return {
    id: id,
    context: samlify.SamlLib.replaceTagsByValue(template, tvalue),
  };
};
