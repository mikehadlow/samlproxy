import { XMLParser } from "fast-xml-parser"
import * as samlify from "samlify"
import * as e from "./entity"

export type Assertion = {
  id: string
  inResponseTo: string
  issuer: string
  audience: string
  issueInstant: Date
  nameID: string
  notBefore: Date
  notOnOrAfter: Date
  destination: string
}

export const parseAssertion = (base64Assertion: string): Assertion => {
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

export const createTemplateCallback = (
  connection: e.SpConnection,
  user: e.User,
  requestId: string,
) => (template: string) => {
  const id = `_${crypto.randomUUID()}`
  const now = new Date()
  const fiveMinutesLater = new Date(now.getTime())
  fiveMinutesLater.setMinutes(fiveMinutesLater.getMinutes() + 5)
  const tvalue = {
    ID: id,
    AssertionID:  `_${crypto.randomUUID()}`,
    Destination: connection.spAcsUrl,
    Audience: connection.spEntityId,
    SubjectRecipient: connection.spEntityId,
    NameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    NameID: user.email,
    Issuer: connection.idpEntityId,
    IssueInstant: now.toISOString(),
    ConditionsNotBefore: now.toISOString(),
    ConditionsNotOnOrAfter: fiveMinutesLater.toISOString(),
    SubjectConfirmationDataNotOnOrAfter: fiveMinutesLater.toISOString(),
    AssertionConsumerServiceURL: connection.spAcsUrl,
    EntityID: connection.spEntityId,
    InResponseTo: requestId,
    StatusCode: "urn:oasis:names:tc:SAML:2.0:status:Success",
  }
  return {
    id: id,
    context: samlify.SamlLib.replaceTagsByValue(template, tvalue),
  }
}
