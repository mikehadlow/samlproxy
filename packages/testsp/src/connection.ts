import { Database } from "bun:sqlite"
import { z } from "zod/v4"
import * as saml from "common/saml"
import { createUser } from "./db"
import { insertIdpConnection } from "common/db"
import { loadCertificate } from "common/keys"
import * as r from "common/result"

const env = z.object({
  spUrlBase: z.url(),
  idpUrlBase: z.url(),
  proxyUrlBase: z.url(),
  idpKeysBasePath: z.string().min(3),
  idpCertificateFile: z.string().min(3),
  proxyKeysBasePath: z.string().min(3),
  proxyCertificateFile: z.string().min(3),
}).parse({
  spUrlBase: process.env["TEST_SP_URL_BASE"],
  idpUrlBase: process.env["TEST_IDP_URL_BASE"],
  proxyUrlBase: process.env["SAML_PROXY_URL_BASE"],
  idpKeysBasePath: process.env["TEST_IDP_CERT_BASE"],
  idpCertificateFile: process.env["TEST_IDP_CERT"],
  proxyKeysBasePath: process.env["SAML_PROXY_CERT_BASE"],
  proxyCertificateFile: process.env["SAML_PROXY_CERT"],
})

const loadCert = (args: { keysBasePath: string, certificateFile: string }): string => {
  const loadResult = loadCertificate(args)
  if ( r.isOk(loadResult) ) {
    return loadResult.value.certificate
  }
  throw new Error("Error loading IdP certificate")
}

const directIdpConnection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: `${env.spUrlBase}/test-sp`,
  spAcsUrl: `${env.spUrlBase}/sp/acs`,
  // IdP (their) properties
  idpEntityId: `${env.idpUrlBase}/test-idp`,
  idpSsoUrl: `${env.idpUrlBase}/idp/sso`,
  // certificate must match the IdP's certificate
  signingCertificate: loadCert({
    keysBasePath: env.idpKeysBasePath,
    certificateFile: env.idpCertificateFile,
  }),
}

const proxyConnection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: `${env.spUrlBase}/test-sp`,
  spAcsUrl: `${env.spUrlBase}/sp/acs`,
  // IdP (their) properties
  idpEntityId: `${env.proxyUrlBase}/proxy`,
  idpSsoUrl: `${env.proxyUrlBase}/proxy/sso`,
  // certificate must match the IdP's certificate
  signingCertificate: loadCert({
    keysBasePath: env.proxyKeysBasePath,
    certificateFile: env.proxyCertificateFile,
  }),
}

// This test SP uses an in-memory database, so it must be initialised
// with some values on startup.
export const initializeDb = (db: Database) => {
  insertIdpConnection(db, directIdpConnection)
  insertIdpConnection(db, proxyConnection)
  createUser(db, {
    email: "joe@blogs.com",
    idpEntityId: directIdpConnection.idpEntityId,
  })
  createUser(db, {
    email: "jane@blogs.com",
    idpEntityId: proxyConnection.idpEntityId,
  })
}
