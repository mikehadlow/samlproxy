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
  keysBasePath: z.string().min(3),
  certificateFile: z.string().min(3),
}).parse({
  spUrlBase: process.env["TEST_SP_URL_BASE"],
  idpUrlBase: process.env["TEST_IDP_URL_BASE"],
  keysBasePath: process.env["TEST_IDP_CERT_BASE"],
  certificateFile: process.env["TEST_IDP_CERT"],
})

const loadCert = (): string => {
  const loadResult = loadCertificate(env)
  if ( r.isOk(loadResult) ) {
    return loadResult.value.certificate
  }
  throw new Error("Error loading IdP certificate")
}

const connection: saml.IdpConnection = {
  // SP (my) properties
  spEntityId: `${env.spUrlBase}/test-sp`,
  spAcsUrl: `${env.spUrlBase}/acs`,
  // IdP (their) properties
  idpEntityId: `${env.idpUrlBase}/test-idp`,
  idpSsoUrl: `${env.idpUrlBase}/sso`,
  // certificate must match the IdP's certificate
  signingCertificate: loadCert(),
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
