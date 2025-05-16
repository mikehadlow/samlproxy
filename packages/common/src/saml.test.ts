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
    console.log(JSON.stringify(properties, null, 2))
    expect(properties.issuer).toEqual(connection.spEntityId)
    expect(properties.request.destination).toEqual(connection.idpSsoUrl)
    expect(properties.request.assertionConsumerServiceUrl).toEqual(connection.spAcsUrl)
  })
})
