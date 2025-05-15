import * as saml from "./saml"
import { expect, test, describe } from "bun:test"

describe("saml", () => {
  test("generateAuthnRequest should work", () => {
    // arrange
    const connection: saml.IdpConnection = {
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "not relevant for generating authnRequest",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      cert: "not relevant for generating authnRequest",
    }

    // act
    const result = saml.generateAuthnRequest(connection)

    // assert
    expect(result.url).not.toBeNull()
    const url = URL.parse(result.url)
    expect(url?.host).toEqual("www.example-idp.com")
    expect(url?.pathname).toEqual("/sso")
    const samlRequest = url?.searchParams.get("SAMLRequest")
    expect(samlRequest).not.toBeNull()
  })
})
