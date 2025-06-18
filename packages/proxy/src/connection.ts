import { Database } from "bun:sqlite"
import { z } from "zod/v4"
import * as saml from "common/saml"
import { insertSpConnection, insertIdpConnection } from "common/db"
import { createLink } from "./db"
import { loadKeys, loadCertificate } from "common/keys"
import * as r from "common/result"

const env = z.object({
  keysBasePath: z.string().min(6),
  encryptionKeyPw: z.string().min(3),
  encryptionKeyFile: z.string().min(3),
  certificateFile: z.string().min(3),
  idpBaseUrl: z.url(),
  spBaseUrl: z.url(),
  proxyBaseUrl: z.url(),
  idpCertificateFile: z.string().min(3),
}).parse({
  keysBasePath: process.env["SAML_PROXY_CERT_BASE"],
  encryptionKeyPw: process.env["SAML_PROXY_CERT_PW"],
  encryptionKeyFile: process.env["SAML_PROXY_PRIVATE_KEY"],
  certificateFile: process.env["SAML_PROXY_CERT"],
  idpBaseUrl: process.env["TEST_IDP_URL_BASE"],
  spBaseUrl: process.env["TEST_SP_URL_BASE"],
  proxyBaseUrl: process.env["SAML_PROXY_URL_BASE"],
  idpCertificateFile: process.env["TEST_IDP_CERT"]
})

// This example SAML proxy uses an in-memory database, so it must be initialised
// with some values on startup.
export const initializeConnections = (db: Database) => {
  const keysResult = loadKeys(env)
  if (r.isFail(keysResult)) {
    throw new Error("Failed to load encryption keys.")
  }
  const keys = keysResult.value

  // the connection to the Service provider
  const spConnection: saml.SpConnection = {
    // IdP (my) properties
    idpEntityId: `${ env.proxyBaseUrl }/proxy`,
    idpSsoUrl: `${ env.proxyBaseUrl }/proxy/sso`,
    privateKey: keys.encryptionKey,
    privateKeyPassword: keys.encryptionKeyPw,
    signingCertificate: keys.certificate,
    // SP (their) properties
    spEntityId: `${ env.spBaseUrl }/test-sp`,
    spAcsUrl: `${ env.spBaseUrl }/sp/acs`,
  }
  insertSpConnection(db, spConnection)

  const certificateResult = loadCertificate({
    keysBasePath: env.keysBasePath,
    certificateFile: env.idpCertificateFile,
  })
  if (r.isFail(certificateResult)) {
    throw new Error("Failed to load IdP certificate.")
  }
  const idpCertificate = certificateResult.value.certificate

  // the connection to the IdP
  const idpConnection: saml.IdpConnection = {
    // SP (my) properties
    spEntityId: `${ env.proxyBaseUrl }/proxy`,
    spAcsUrl: `${ env.proxyBaseUrl }/proxy/acs`,
    // IDP (their) properites
    idpEntityId: `${ env.idpBaseUrl }/test-idp`,
    idpSsoUrl: `${ env.idpBaseUrl }/idp/sso`,
    signingCertificate: idpCertificate,
  }
  insertIdpConnection(db, idpConnection)

  createLink(db, {
    spEntityId: spConnection.spEntityId,
    idpEntityId: idpConnection.idpEntityId,
  })
}
