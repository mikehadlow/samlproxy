import { Database } from "bun:sqlite"
import * as fs from "fs"
import * as z from "zod/v4"
import * as r from "common/result"
import {
  createDb,
  createSpConnectionTable,
  createIdpConnectionTable,
  snakeToCamel,
} from "common/db"
import { initializeConnections } from "./connection"

const createSql = `${__dirname}/db.sql`

const relayStateParser = z.object({
  relay_state: z.string(),
  sp_entity_id: z.string(),
  timestamp: z.number(),
  used: z.literal([0, 1]),
})
type RelayState = z.infer<typeof relayStateParser>

const linkParser = z.object({
  spEntityId: z.string(),
  idpEntityId: z.string(),
})
type Link = z.infer<typeof linkParser>

export const proxyTables = (db: Database) => {
  const sql = fs.readFileSync(createSql, "utf-8")
  db.exec(sql)
}

export const recordRelayState = (db: Database, args: { relayState: string, spEntityId: string }) => {
  using query = db.query(`INSERT INTO relay_state
    ( relay_state, sp_entity_id, timestamp, used )
    VALUES (
      $relayState,
      $spEntityId,
      $timestamp,
      $used
    );`)
  query.run({
    ... args,
    timestamp: Date.now(),
    used: 0,
  })
}

export const consumeRelayState = (db: Database, args: { relayState: string }): r.Result<RelayState> => {
  const { relayState } = args
  using query = db.query(`SELECT relay_state, sp_entity_id, timestamp, used
    FROM relay_state
    WHERE relay_state = $relayState
    AND used = 0
    ;`)
  const result = query.get({
    relayState,
  })
  if (!result) {
    return r.fail("RelayState is invalid.")
  }
  // updated used to 1, so this relay state can't be used a second time
  using updateUsed = db.query(`UPDATE relay_state SET used = 1 WHERE relay_state = $relayState;`)
  updateUsed.run({
    relayState,
  })
  return r.from(relayStateParser.parse(result))
}

export const createLink = (db: Database, args: { spEntityId: string, idpEntityId: string }) => {
  using query = db.query(`INSERT INTO sp_to_idp_link (sp_entity_id, idp_entity_id)
    VALUES ( $spEntityId, $idpEntityId );`)
  query.run(args)
}

export const getLinkedSpEntityId = (db: Database, args: { idpEntityId: string }): r.Result<Link> => {
  using query = db.query(`SELECT sp_entity_id, idp_entity_id FROM sp_to_idp_link WHERE idp_entity_id = $idpEntityId;`)
  const result = query.get(args)
  if (!result) {
    return r.fail(`No linked SP found for IdP: ${args.idpEntityId}`)
  }
  return r.from(linkParser.parse(snakeToCamel(result)))
}

export const getLinkedIdpEntityId = (db: Database, args: { spEntityId: string }): r.Result<Link> => {
  using query = db.query(`SELECT sp_entity_id, idp_entity_id FROM sp_to_idp_link WHERE sp_entity_id = $spEntityId;`)
  const result = query.get(args)
  if (!result) {
    return r.fail(`No linked IdP found for SP: ${args.spEntityId}`)
  }
  return r.from(linkParser.parse(snakeToCamel(result)))
}

export const initDb = (): Database => {
  const con = createDb([
    createSpConnectionTable,
    createIdpConnectionTable,
    proxyTables,
  ])
  initializeConnections(con)
  return con
}
