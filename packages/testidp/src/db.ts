import { createDb, createSpConnectionTable, snakeToCamel } from "common/db"
import { Database } from "bun:sqlite"
import { initializeConnections } from "./connection"
import * as fs from "fs"
import * as r from "common/result"
import { idpUserParser, userConnectionParser, type IdpUser, type UserConnection } from "./entity"

const createSql = `${__dirname}/db.sql`

export const idpPrivateTables = (db: Database) => {
  const sql = fs.readFileSync(createSql, "utf-8")
  db.exec(sql)
}

export const initDb = (): Database => {
  const con = createDb([createSpConnectionTable, idpPrivateTables])
  initializeConnections(con)
  return con
}

export const createUser = (db: Database, args: { email: string, connectionId: string }) => {
  using query = db.query(`INSERT INTO user ( email, connection_id )
    VALUES ( $email, $connectionId );`)
  query.run(args)
}

export const getUser = (db: Database, args: { email: string }): r.Result<IdpUser> => {
  using query = db.query(`SELECT email, connection_id FROM user WHERE email = $email;`)
  const result = query.get(args)
  if (!result) {
    return r.fail("Invalid email.")
  }
  return r.from(idpUserParser.parse(snakeToCamel(result)))
}

export const getAllUsersAndConnections = (db: Database): UserConnection[] => {
  using query = db.query(`SELECT u.email, c.name
    FROM user u
    JOIN sp_connection c ON u.connection_id = c.id
    ;`)
  const results = query.all()
  return results.map((x) => userConnectionParser.parse(x))
}
