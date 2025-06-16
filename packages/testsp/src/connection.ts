import { Database } from "bun:sqlite"
import * as saml from "common/saml"
import { createUser } from "./db"
import { insertIdpConnection } from "common/db"

const connection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: "http://localhost:7282/test-sp",
  spAcsUrl: "http://localhost:7282/acs",
  // IdP (their) properties
  idpEntityId: "http://localhost:7292/test-idp",
  idpSsoUrl: "http://localhost:7292/sso",
  // certificate must match the IdP's certificate
  signingCertificate: `-----BEGIN CERTIFICATE-----
  MIIEwDCCAqgCCQCCO8v0iwS94zANBgkqhkiG9w0BAQsFADAiMSAwHgYJKoZIhvcN
  AQkBFhFtZUBtaWtlaGFkbG93LmNvbTAeFw0yNTA2MTYwOTU2NThaFw0zNTA2MTQw
  OTU2NThaMCIxIDAeBgkqhkiG9w0BCQEWEW1lQG1pa2VoYWRsb3cuY29tMIICIjAN
  BgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwCJb0i7oEfnAaub+vb8xoW/22MKF
  HfpVq42iI56ddPQIEqd7B+dPHvUE7fen5Tcoqf5xsYa20pINHEagl1YFDcKKDeJA
  rFvU90DzLqX3cWM26uwZLeVF4mNfuEKn5jZB2R9JrlHOZe7nf1ESCxEaFQXc4BQg
  VZZSBnsOO+7yzq/ov9+3mbvg+UhHPRe6wE5koMezweH5f1EO2ykkp2HMvTLuDoTm
  KqAb6q0nLvE7H4yo5j7d0gQjOVMgh2Dzi/njr9e6rrTRl9YJrFzaVLt5JDXv9ibW
  nC0P5I0OCsZ9kMf4ahBcdA6og63uMWhmrBO+0Mc096HbIRV9jqOvr0o7SBY/MH5z
  rlaFT/D6d+1k+VyeiYV/PdmlSaNrEJHD6wmIPIoQwnpVaYknkIysHQOeEmTcOMpV
  VZfgFCHKawUEXfXEv601HuG+Bz7D+yQfcNfycsFVMvqaJCOPZYvIvNeqf2laDZNA
  RtAZH+UI+RkvbzAiQXVTuxqapz5bZ2hQy1Arzs2l8jk3KGNG9QVnp5LcGAMnbuOG
  FOhpR1Tzhsm3dg51MKCzwsUs2fYq3Du1JeIUE3LH//+YUePfX0hPRbJt7Sjf3wE4
  FZSNJVx+Yn2+BQfVwxwEMtsjEHhoLlKijuv1JbTo3ZdsKGk17PaqwPnm61ic8XOy
  J4AuehxfwjEt1fECAwEAATANBgkqhkiG9w0BAQsFAAOCAgEAWq154J5bHmF7espJ
  4EfmOYrT/4j8Vz7ETQ10qU9q9Rvw0kmikUHyNc8yRBbJlhxpl7A8qywueWeW5sWl
  FL9WSDmNoXcrXCI/9E2cY2CLby0gLaLcjr4mWot1hWaC1TPT4+jDw9fXqhyuktQh
  If9QUlCunVXHmM07BFIPYzXicmKdaFdVsHZZmUvq6KmMswdmMbBYd0eD7dx77BXl
  dmSpXcFOp2QxyVs3xU6X/8lIUb9Qvv3UL/CylqHK54N7i51BesV1mUns0G4NlHUL
  +o/i6JDuwucLnQc2sfBATJQ4eJPJ5xm3UFWHvS4sn2+rRtbPGdULXrvQG82g+raT
  ffmzvdK9pzE4ARPJmEAtfo5kLnrVVh3JfRWnH75sSgJ6TRK2h1KoivbsZblMqCo3
  7ZzEhLDIxUWCtWGkzlvv5tapo65TFWDSa9CYDTQhu5qB7W+C5sh9xwSEmZ6SkE0X
  eyOfLv4HGIWT+02HSwd0PRYxH8UuATbebHhsuZPpHRZ22DJn4Vb01BGSIUhynVGZ
  XXY1qw2CVGhP04Fq+Y/wl9/YxSwVeaNBWcrwz+DsiCwsuoLZ52cqW0civ4J4lq+Q
  Rd/v78apYCGsXB4uR2GZEFOG8dw5X8H2+ifS1UwjJ5S9211MTwOVFU3vSZpc2fkK
  2JihITknKJOJZtratGeuG0uqleg=
  -----END CERTIFICATE-----`,
}

// This test SP uses an in-memory database, so it must be initialised
// with some values on startup.
export const initializeDb = (db: Database) => {
  insertIdpConnection(db, connection)
  createUser(db, {
    email: "joe@blogs.com",
    idpEntityId: connection.idpEntityId,
  })
}
