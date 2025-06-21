import * as saml from "./saml"
import * as samlify from "samlify"
import { expect, test, describe } from "bun:test"
import * as r from "./result"
import * as assets from "./test-assets"
import * as assertion from "./assertion"
import * as e from "./entity"
import * as fs from "fs"
import * as path from "path"

describe("saml", () => {
  test("generateAuthnRequest should work", () => {
    // arrange
    const connection: e.IdpConnection = {
      id: crypto.randomUUID(),
      name: "My Connection",
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.example-sp.com/acs",
      spAllowIdpInitiated: true,
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      signingCertificate: "not relevant for generating authnRequest",
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

  test("validateAuthnRequest should pass valid request", () => {
    const spEntityId = "the-sp-entity-id"
    const spAcsUrl = "https://www.example-sp.com/acs"
    const connection = {
      spEntityId,
      spAcsUrl,
    }
    const details = {
      issuer: spEntityId,
      acsUrl: spAcsUrl,
    }
    const result = saml.validateAuthnRequest({ connection, details })
    expect(r.isOk(result)).toBeTrue()
  })

  test("validateAuthnRequest should fail on unmatched entityId", () => {
    const spEntityId = "the-sp-entity-id"
    const spAcsUrl = "https://www.example-sp.com/acs"
    const connection = {
      spEntityId,
      spAcsUrl,
    }
    const details = {
      issuer: `${ spEntityId }-not`,
      acsUrl: spAcsUrl,
    }
    const result = saml.validateAuthnRequest({ connection, details })
    expect(r.isFail(result)).toBeTrue()
    if(r.isOk(result)) throw new Error("Type coertion")
    expect(result.message).toEqual("Invalid Issuer")
  })

  test("validateAuthnRequest should fail on unmatched acsUrl", () => {
    const spEntityId = "the-sp-entity-id"
    const spAcsUrl = "https://www.example-sp.com/acs"
    const connection = {
      spEntityId,
      spAcsUrl,
    }
    const details = {
      issuer: spEntityId,
      acsUrl:  `${ spAcsUrl }-not`,
    }
    const result = saml.validateAuthnRequest({ connection, details })
    expect(r.isFail(result)).toBeTrue()
    if(r.isOk(result)) throw new Error("Type coertion")
    expect(result.message).toEqual("Unmatched ACS URL")
  })

  test("generateAssertion should work", async () => {
    // arrange
    const connection: e.SpConnection = {
      id: crypto.randomUUID(),
      name: "My SP",
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.example-sp.com/acs",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      privateKey: assets.testPrivateKey,
      privateKeyPassword: assets.testPrivateKeyPassword,
      signingCertificate: assets.testPublicKey,
    }
    const user: e.User = {
      email: "leo@hadlow.com"
    }
    const relayState = "the-relay-state"
    const requestId = "the-reqeust-id"

    // act
    const result = await saml.generateAssertion({ connection, requestId, relayState, user })

    // assert
    expect(result.acsUrl).toEqual(connection.spAcsUrl)
    expect(result.relayState).toEqual(relayState)
    // const xml = samlify.Utility.base64Decode(result.assertion, false)
    // console.log(xml)
    const parsedAssertion = saml.parseAssertion(result.assertion)
    // TODO: Work out why these are different
    // expect(parsedAssertion.id).toEqual(result.id)
    expect(parsedAssertion.inResponseTo).toEqual(requestId)
    expect(parsedAssertion.issuer).toEqual(connection.idpEntityId)
    expect(parsedAssertion.audience).toEqual(connection.spEntityId)
    expect(parsedAssertion.nameID).toEqual(user.email)
    expect(parsedAssertion.destination).toEqual(connection.spAcsUrl)
    const now = new Date()
    expect(parsedAssertion.issueInstant).toBeValidDate()
    expect(parsedAssertion.notBefore).toBeValidDate()
    expect(parsedAssertion.notOnOrAfter).toBeValidDate()
    expect(now > parsedAssertion.notBefore).toBeTrue()
    expect(now < parsedAssertion.notOnOrAfter).toBeTrue()
  })

  test("validateAssertion should work", async () => {
    const connectionCommon = {
      id: crypto.randomUUID(),
      name: "My Connection",
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.example-sp.com/acs",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.example-idp.com/sso",
      signingCertificate: assets.testPublicKey,
    }
    const spConnection: e.SpConnection = {
      ...connectionCommon,
      privateKey: assets.testPrivateKey,
      privateKeyPassword: assets.testPrivateKeyPassword,
    }
    const user: e.User = {
      email: "leo@hadlow.com"
    }
    const relayState = "the-relay-state"
    const requestId = "the-reqeust-id"
    const assertionResult = await saml.generateAssertion({ connection: spConnection, requestId, relayState, user })
    const idpConnection: e.IdpConnection = {
      ...connectionCommon,
      spAllowIdpInitiated: true,
    }

    // act
    const result = await saml.validateAssertion({
      connection: idpConnection,
      encodedAssertion: assertionResult.assertion,
    })
    expect(r.isOk(result)).toBeTrue()
  })

  test("parseAssertion should parse assertion", () => {
    // arrange
    const connection: e.SpConnection = {
      id: crypto.randomUUID(),
      name: "My SP",
      idpEntityId: "the-idp-entity-id",
      idpSsoUrl: "https://www.idp.com/sso",
      privateKey: "the-long-private-key-string",
      privateKeyPassword: "some-password",
      signingCertificate: "the-long-cert-string",
      spEntityId: "the-sp-entity-id",
      spAcsUrl: "https://www.sp.com/acs",
    }
    const user: e.User = {
      email: "hello@fubar.com"
    }
    const requestId = "the-request-id"
    const assertionTemplate = fs.readFileSync(path.join(__dirname, 'assertion-template.xml'), 'utf8')
    const result = assertion.createTemplateCallback({ connection, user, requestId })(assertionTemplate)
    const base64Asssertion = btoa(result.context)

    // act
    const parsedAssertion = saml.parseAssertion(base64Asssertion)

    // assert
    expect(true).toBe(true);
    expect(parsedAssertion.id).toBeString()
    expect(parsedAssertion.inResponseTo).toEqual(requestId)
    expect(parsedAssertion.issuer).toEqual(connection.idpEntityId)
    expect(parsedAssertion.audience).toEqual(connection.spEntityId)
    expect(parsedAssertion.issueInstant).toBeDate()
    expect(parsedAssertion.nameID).toEqual(user.email)
    expect(parsedAssertion.notBefore).toBeDate()
    expect(parsedAssertion.notOnOrAfter).toBeDate()
  });
})
