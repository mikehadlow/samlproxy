import { Database } from "bun:sqlite"
import { z } from "zod/v4"
import * as saml from "common/saml"
import * as fs from "fs"
import * as path from "path"
import { insertSpConnection } from "common/db"

const env = z.object({
  certPw: z.string().min(6),
  idpBaseUrl: z.url(),
  spBaseUrl: z.url(),
  proxyBaseUrl: z.url(),
}).parse({
  certPw: process.env["TEST_IDP_CERT_PW"],
  idpBaseUrl: process.env["TEST_IDP_URL_BASE"],
  spBaseUrl: process.env["TEST_SP_URL_BASE"],
  proxyBaseUrl: process.env["SAML_PROXY_URL_BASE"],
})

// This test IdP uses an in-memory database, so it must be initialised
// with some values on startup.
export const initializeConnections = (db: Database) => {
  const readKey = (key:string) => fs.readFileSync(path.join(__dirname, "keys", key), "utf8")
  const encryptKey = readKey("encryptKey.pem")
  const encryptionCert = readKey("encryptionCert.cer")

  const connection: saml.SpConnection = {
    // IdP (my) properties
    idpEntityId: `${ env.idpBaseUrl }/test-idp`,
    idpSsoUrl: `${ env.idpBaseUrl }/sso`,
    privateKey: encryptKey,
    privateKeyPassword: env.certPw,
    signingCertificate: encryptionCert,
    // SP (their) properties
    spEntityId: `${ env.spBaseUrl }/test-sp`,
    spAcsUrl: `${ env.spBaseUrl }/acs`,
  }

  insertSpConnection(db, connection)
}
