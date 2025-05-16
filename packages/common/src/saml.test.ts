import * as saml from "./saml"
import * as samlify from "samlify"
import { expect, test, describe } from "bun:test"
import * as r from "./result"

describe("saml", () => {
  test("generateAuthnRequest should work", () => {
    // arrange
    const connection: saml.IdpConnection = {
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.example-sp.com/acs",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      cert: "not relevant for generating authnRequest",
    }
    const relayState = "the-relay-state"

    // act
    const result = saml.generateAuthnRequest({ connection, relayState })

    // assert
    expect(result.url).not.toBeNull()
    const url = URL.parse(result.url)
    expect(url?.host).toEqual("www.example-idp.com")
    expect(url?.pathname).toEqual("/sso")
    const urlRelayState = url?.searchParams.get("RelayState")
    expect(urlRelayState).toEqual(relayState)
    const samlRequest = url?.searchParams.get("SAMLRequest")
    expect(samlRequest).not.toBeNull()
    if (typeof samlRequest !== "string") {
      throw new Error("samlRequest is not a string")
    }
    const xml = samlify.Utility.inflateString(samlRequest)
    const properties = samlify.Extractor.extract(xml, samlify.Extractor.loginRequestFields)
    expect(properties.issuer).toEqual(connection.spEntityId)
    expect(properties.request.destination).toEqual(connection.idpSsoUrl)
    expect(properties.request.assertionConsumerServiceUrl).toEqual(connection.spAcsUrl)
  })

  test("parseAuthnRequest should parse valid request", () => {
    // arrange
    const expectedIssueDate = new Date("2025-05-16T10:49:46.840Z")
    const authnRequest = "fZJfT8IwFMW/ytL37p9jsAZIEGIkQV0AffDFlO4iTbp29nYC394yNMFEeb3n/nrOaTtEXquGTVq300v4aAFdcKiVRtYJI9JazQxHiUzzGpA5wVaThwVLw5g11jgjjCIXyHWCI4J10mgSzGcj8sZjXhRbAXQwyG9olmcVHaSZoP1Nuun1eR5DwUnwAhY9MyL+CA8itjDX6Lh2fhSnPRr3aJKvk5hlBcvycJDFrySY+S5Sc9eRO+caZFG03+9DOPC6UUBl1YTC1BGiIUH53eVW6krq9+s1NuclZPfrdUnLp9WaBJOfalOjsa3BrsB+SgHPy8Xf9nh25wLJeHi6OtY1s2O3O4kUtJPu6FMOo0t1eH6xRx9qPiuNkuIY3Blbc/d/5iRMuoms6LZbZVBzqSZVZQHRZ1fK7KcWuIMR2XKFQKLx2fb33xh/AQ=="

    // act
    const result = saml.parseAuthnRequest({ authnRequest })

    // assert
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) return // a little type narrowing
    expect(result.value).not.toBeNull()
    expect(result.value.id).not.toBeNull()
    expect(result.value.issuer).toEqual("the-sp-entity-id")
    expect(result.value.acsUrl).toEqual("https://www.example-sp.com/acs")
    expect(result.value.ssoUrl).toEqual("https://www.example-idp.com/sso")
    expect(result.value.issueInstant).toEqual(expectedIssueDate)
  })

  test("parseAuthnRequest should reject invalid deflate string", () => {
    // arrange
    const authnRequest = "not-a-valid-deflate-string"

    // act
    const result = saml.parseAuthnRequest({ authnRequest })

    // assert
    expect(r.isFail(result)).toBeTrue()
    if(r.isOk(result)) return
    expect(result.message).toEqual("Malformed AuthnRequest")
  })

  test("parseAuthnRequest should reject invalid xml", () => {
    // arrange
    const invalidXml = "<NotAnAuthnRequest></NotAnAuthnRequest>"
    const authnRequest = samlify.Utility.base64Encode(samlify.Utility.deflateString(invalidXml))

    // act
    const result = saml.parseAuthnRequest({ authnRequest })

    // assert
    expect(r.isFail(result)).toBeTrue()
    if(r.isOk(result)) return
    expect(result.message).toEqual("Malformed AuthnRequest")
  })
})
