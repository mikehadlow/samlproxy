
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
  signingCertificate: string,
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

export type AssertionExtract = {
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

export type User = {
  email: string,
}
