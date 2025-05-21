import { XMLParser } from "fast-xml-parser"
import * as samlify from "samlify"

export type Assertion = {
  id: string
  inResponseTo: string
  issuer: string
  audience: string
  issueInstant: string
  nameID: string
  notBefore: string
  notOnOrAfter: string
}

export const parseAssertion = (base64Assertion: string): any => {
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
  }
}
