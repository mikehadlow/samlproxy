import * as samlify from "samlify"
import * as r from "./result"
import * as e from "./entity"
import * as assertion from "./assertion"
import * as fs from "fs"
import * as path from "path"
import { XMLParser } from "fast-xml-parser"

export * from "./entity"

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
  const { context, id } = sp.createLoginRequest(idp, 'redirect')
  return {
    id,
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

export const validateAuthnRequest = (args: {
  connection: Pick<e.SpConnection, "spEntityId" | "spAcsUrl">,
  details: Pick<e.AuthnRequestDetails, "issuer" | "acsUrl">,
}): r.VoidResult => {
  const { connection, details } = args
  if(details.issuer !== connection.spEntityId) {
    return r.fail("Invalid Issuer")
  }
  if (details.acsUrl !== connection.spAcsUrl) {
    return r.fail("Unmatched ACS URL")
  }
  return r.voidResult
}

export const generateAssertion = async (args: {
    connection: e.SpConnection,
    user: e.User,
    requestId?: string,
    relayState?: string,
  }): Promise<e.Assertion> => {
  const {
    connection,
    user,
    requestId,
    relayState,
  } = args
  const assertionTemplate = fs.readFileSync(path.join(__dirname, 'assertion-template.xml'), 'utf8')
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
      context: assertionTemplate,
      attributes: [],
    },
  })
  const { id, context } = await idp.createLoginResponse(
    sp,
    { extract: { request: { id: requestId } } }, // request info
    'post', // binding
    user,
    assertion.createTemplateCallback({ connection, user, requestId }),
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

export const validateAssertion = async (args: {
  connection: e.IdpConnection,
  encodedAssertion: string,
}): Promise<r.VoidResult> => {
  const {
    connection,
    encodedAssertion,
  } = args
  const sp = samlify.ServiceProvider({
    entityID: connection.spEntityId,
    assertionConsumerService: [{
      Binding: samlify.Constants.BindingNamespace.Post,
      Location: connection.spAcsUrl,
    }]
  })
  const idp = samlify.IdentityProvider({
    entityID: connection.idpEntityId,
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
  })
  const request = {
    body: {
      SAMLResponse: encodedAssertion,
    }
  }
  try {
    await sp.parseLoginResponse(idp, 'post', request);
    return r.voidResult
  }
  catch (error) {
    console.error(error)
    if (error instanceof Error) {
      console.error(error.message)
      return r.fail(error.message)
    }
    return r.fail(`Error: ${error}`)
  }
}

export const parseAssertion = (base64Assertion: string): e.AssertionExtract => {
  const xml = samlify.Utility.base64Decode(base64Assertion, false)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    trimValues: true,
    removeNSPrefix: true
  })
  const properties = parser.parse(xml)
  return {
    id: properties["Response"]["@_ID"],
    inResponseTo: properties["Response"]["@_InResponseTo"],
    issuer: properties["Response"]["Issuer"],
    audience: properties["Response"]["Assertion"]["Conditions"]["AudienceRestriction"]["Audience"],
    issueInstant: new Date(properties["Response"]["@_IssueInstant"]),
    nameID: properties["Response"]["Assertion"]["Subject"]["NameID"]["#text"],
    notBefore: new Date(properties["Response"]["Assertion"]["Conditions"]["@_NotBefore"]),
    notOnOrAfter: new Date(properties["Response"]["Assertion"]["Conditions"]["@_NotOnOrAfter"]),
    destination: properties["Response"]["@_Destination"]
  }
}
