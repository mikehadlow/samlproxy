import * as z from "zod"

// An idpConnection encapsulates an SP's connection to an IdP. So it is responsible
// for creating the intial SP-initiated AuthnRequest, and also for consuming
// the Assertion returned by the IdP at the Assertion Consumer Service endpoint.
export const idpConnectionParser = z.object({
  id: z.string().uuid(),
  name: z.string().min(3),
  // SP (my) properties
  spEntityId: z.string().min(3),
  spAcsUrl: z.string().url(),
  spAllowIdpInitiated: z.boolean().default(false),
  // IdP (their) properties
  idpEntityId: z.string().min(3),
  idpSsoUrl: z.string().url(),
  signingCertificate: z.string().min(32),
})
export type IdpConnection = z.infer<typeof idpConnectionParser>

// An spConnection encapsulates an IdP's connection to an SP. So it is responsible
// for consuming an SP-initiated AuthnRequest, authenticating the principle, and
// constructing and signing the assertion.
export const spConnectionParser = z.object({
  id: z.string().uuid(),
  name: z.string().min(3),
  // IdP (my) properties
  idpEntityId: z.string().min(3),
  idpSsoUrl: z.string().url(),
  privateKey: z.string().min(32),
  privateKeyPassword: z.string().min(3),
  signingCertificate: z.string().min(32),
  // SP (their) properties
  spEntityId: z.string().min(3),
  spAcsUrl: z.string().url(),
})
export type SpConnection = z.infer<typeof spConnectionParser>

export type AuthnRequest = {
  id: string,
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
  relayState?: string,
}

export type AssertionExtract = {
  id: string
  inResponseTo?: string
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
