import { Database } from "bun:sqlite"
import * as fs from "fs"
import * as e from "./entity"
import * as r from "./result"

const sqlDir = `${__dirname}/sql`
const idp_connection_sql = `${sqlDir}/idp_connection.sql`
const sp_connection_sql = `${sqlDir}/sp_connection.sql`

export const snakeToCamel = (snake: Record<string, any>): Record<string, any> => {
  const toCamel = (str: string) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
  return Object.keys(snake).reduce((acc: Record<string, any>, current: string) => {
    acc[toCamel(current)] = snake[current]
    return acc
  }, {})
}

export const intsToBools = (row: Record<string, any>, booleanColumns: string[]): Record<string, any> => {
  return Object.keys(row).reduce((acc: Record<string, boolean>, current: string) => {
    if(booleanColumns.includes(current)) {
      acc[current] = row[current] === 1
    }
    else {
      acc[current] = row[current]
    }
    return acc
  }, {})
}

export const boolsToInts = (row: Record<string, any>): Record<string, any> => {
  return Object.keys(row).reduce((acc: Record<string, any>, current: string) => {
    if(typeof row[current] === "boolean") {
      acc[current] = row[current] ? 1 : 0
    }
    else {
      acc[current] = row[current]
    }
    return acc
  }, {})
}

export const createDb = (creationScripts: ((db:Database) => void)[]) => {
  const db = new Database(":memory:", {
    strict: true,
  })
  for (const create of creationScripts) {
    create(db)
  }
  return db
}

export const createIdpConnectionTable = (db: Database): void => {
  const sql = fs.readFileSync(idp_connection_sql, "utf-8")
  db.exec(sql)
}

export const createSpConnectionTable = (db: Database): void => {
  const sql = fs.readFileSync(sp_connection_sql, "utf-8")
  db.exec(sql)
}

export const insertIdpConnection = (db: Database, connection: e.IdpConnection): void => {
  // acts as a validator here
  e.idpConnectionParser.parse(connection)
  using query = db.query(`
    INSERT INTO idp_connection (
      id,
      name,
      sp_entity_id,
      sp_acs_url,
      sp_allow_idp_initiated,
      idp_entity_id,
      idp_sso_url,
      signing_certificate
    )
    VALUES (
      $id,
      $name,
      $spEntityId,
      $spAcsUrl,
      $spAllowIdpInitiated,
      $idpEntityId,
      $idpSsoUrl,
      $signingCertificate
    );`)
  query.run(boolsToInts(connection))
}

export const getIdpConnection = (db: Database, args: { idpEntityId: string }): r.Result<e.IdpConnection> => {
  using query = db.query(`
    SELECT
      id,
      name,
      sp_entity_id,
      sp_acs_url,
      sp_allow_idp_initiated,
      idp_entity_id,
      idp_sso_url,
      signing_certificate
    FROM idp_connection
    WHERE idp_entity_id = $idpEntityId
    `)
  const result = query.get(args)
  return (result)
    ? r.from(e.idpConnectionParser.parse(snakeToCamel(intsToBools(result, ["sp_allow_idp_initiated"]))))
    : r.fail(`Invalid IdP entity ID: ${ args.idpEntityId }. No connection found`)
}

export const insertSpConnection = (db: Database, connection: e.SpConnection): void => {
  // acts as a validator here
  e.spConnectionParser.parse(connection)
  using query = db.query(`
    INSERT INTO sp_connection (
      id,
      name,
      idp_entity_id,
      idp_sso_url,
      private_key,
      private_key_password,
      signing_certificate,
      sp_entity_id,
      sp_acs_url
    )
    VALUES (
      $id,
      $name,
      $idpEntityId,
      $idpSsoUrl,
      $privateKey,
      $privateKeyPassword,
      $signingCertificate,
      $spEntityId,
      $spAcsUrl
    );`)
  query.run(connection)
}

export const getSpConnection = (db: Database, args: { spEntityId: string }): r.Result<e.SpConnection> => {
  using query = db.query(`
    SELECT
      id,
      name,
      idp_entity_id,
      idp_sso_url,
      private_key,
      private_key_password,
      signing_certificate,
      sp_entity_id,
      sp_acs_url
    FROM sp_connection
    WHERE sp_entity_id = $spEntityId
    `)
  const result = query.get(args)
  return (result)
    ? r.from(e.spConnectionParser.parse(snakeToCamel(result)))
    : r.fail("Invalid SP entity ID. No connection found")
}

export const getSpConnectionById = (db: Database, args: { id: string }): r.Result<e.SpConnection> => {
  using query = db.query(`
    SELECT
      id,
      name,
      idp_entity_id,
      idp_sso_url,
      private_key,
      private_key_password,
      signing_certificate,
      sp_entity_id,
      sp_acs_url
    FROM sp_connection
    WHERE id = $id
    `)
  const result = query.get(args)
  return (result)
    ? r.from(e.spConnectionParser.parse(snakeToCamel(result)))
    : r.fail("Invalid SP entity ID. No connection found")
}

export const getAllSpConnections = (db: Database): e.SpConnection[] => {
  using query = db.query(`
    SELECT
      id,
      name,
      idp_entity_id,
      idp_sso_url,
      private_key,
      private_key_password,
      signing_certificate,
      sp_entity_id,
      sp_acs_url
    FROM sp_connection
    `)
  const results = query.all()
  return results
    .filter((row) => row !== null && typeof row === "object")
    .map((row) => e.spConnectionParser.parse(snakeToCamel(row)))
}
