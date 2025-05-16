import * as saml from "./saml"
import * as samlify from "samlify"
import { expect, test, describe } from "bun:test"

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

  test("parseAuthnRequest should parse valid request", async () => {
    // arrange
    const connection: saml.IdpConnection = {
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.example-sp.com/acs",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      cert: "not relevant for generating authnRequest",
    }
    const authnRequest = "fZJfT8IwFMW/ytL37p9jsAZIEGIkQV0AffDFlO4iTbp29nYC394yNMFEeb3n/nrOaTtEXquGTVq300v4aAFdcKiVRtYJI9JazQxHiUzzGpA5wVaThwVLw5g11jgjjCIXyHWCI4J10mgSzGcj8sZjXhRbAXQwyG9olmcVHaSZoP1Nuun1eR5DwUnwAhY9MyL+CA8itjDX6Lh2fhSnPRr3aJKvk5hlBcvycJDFrySY+S5Sc9eRO+caZFG03+9DOPC6UUBl1YTC1BGiIUH53eVW6krq9+s1NuclZPfrdUnLp9WaBJOfalOjsa3BrsB+SgHPy8Xf9nh25wLJeHi6OtY1s2O3O4kUtJPu6FMOo0t1eH6xRx9qPiuNkuIY3Blbc/d/5iRMuoms6LZbZVBzqSZVZQHRZ1fK7KcWuIMR2XKFQKLx2fb33xh/AQ=="

    // act
    const result = await saml.parseAuthnRequest({ connection, authnRequest })

    // assert
    expect(result).not.toBeNull()
    expect(result.id).not.toBeNull()
    expect(result.issuer).toEqual(connection.spEntityId)
  })
})
