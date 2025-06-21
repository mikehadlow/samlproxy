import { Database } from "bun:sqlite"
import { z } from "zod/v4"
import * as saml from "common/saml"
import { insertSpConnection } from "common/db"
import { loadKeys } from "common/keys"
import * as r from "common/result"

const env = z.object({
  keysBasePath: z.string().min(6),
  encryptionKeyPw: z.string().min(3),
  encryptionKeyFile: z.string().min(3),
  certificateFile: z.string().min(3),
  idpBaseUrl: z.url(),
  spBaseUrl: z.url(),
  proxyBaseUrl: z.url(),
}).parse({
  keysBasePath: process.env["TEST_IDP_CERT_BASE"],
  encryptionKeyPw: process.env["TEST_IDP_CERT_PW"],
  encryptionKeyFile: process.env["TEST_IDP_PRIVATE_KEY"],
  certificateFile: process.env["TEST_IDP_CERT"],
  idpBaseUrl: process.env["TEST_IDP_URL_BASE"],
  spBaseUrl: process.env["TEST_SP_URL_BASE"],
  proxyBaseUrl: process.env["SAML_PROXY_URL_BASE"],
})

// This test IdP uses an in-memory database, so it must be initialised
// with some values on startup.
export const initializeConnections = (db: Database) => {
  const keysResult = loadKeys(env)
  if (r.isFail(keysResult)) {
    throw new Error("Failed to load encryption keys.")
  }
  const keys = keysResult.value

  const directSpConnection: saml.SpConnection = {
    id: crypto.randomUUID(),
    name: "Direct To SP",
    // IdP (my) properties
    idpEntityId: `${ env.idpBaseUrl }/test-idp`,
    idpSsoUrl: `${ env.idpBaseUrl }/idp/sso`,
    privateKey: keys.encryptionKey,
    privateKeyPassword: keys.encryptionKeyPw,
    signingCertificate: keys.certificate,
    // SP (their) properties
    spEntityId: `${ env.spBaseUrl }/test-sp`,
    spAcsUrl: `${ env.spBaseUrl }/sp/acs`,
  }

  const proxyConnection: saml.SpConnection = {
    id: crypto.randomUUID(),
    name: "Via Proxy",
    // IdP (my) properties
    idpEntityId: `${ env.idpBaseUrl }/test-idp`,
    idpSsoUrl: `${ env.idpBaseUrl }/idp/sso`,
    privateKey: keys.encryptionKey,
    privateKeyPassword: keys.encryptionKeyPw,
    signingCertificate: keys.certificate,
    // SP (their) properties
    spEntityId: `${ env.proxyBaseUrl }/proxy`,
    spAcsUrl: `${ env.proxyBaseUrl }/proxy/acs`,
  }

  insertSpConnection(db, directSpConnection)
  insertSpConnection(db, proxyConnection)
}
