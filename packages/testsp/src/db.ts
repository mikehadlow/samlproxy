import { Database } from "bun:sqlite"
import * as fs from "fs"
import * as path from "path"
import * as z from "zod/v4"
import * as r from "common/result"

const dbFolder = `${__dirname}/../db`
const dbPath = path.join(dbFolder, "db.sqlite3")
const createSql = `${__dirname}/db.sql`

const relayStateParser = z.object({
  relay_state: z.string(),
  email: z.email(),
  timestamp: z.number(),
  used: z.literal([0, 1]),
})
type RelayState = z.infer<typeof relayStateParser>

const openDb = () => new Database(dbPath, {
  create: true,
  strict: true,
})

const init = () => {
  if (!fs.existsSync(dbPath)) {
    // create the database
    using db = openDb()

    // run the create table statements
    const sql = fs.readFileSync(createSql, "utf-8")
    using query = db.query(sql)
    query.run()
  }
}

export const recordRelayState = (args: { relayState: string, email: string }) => {
  const { relayState, email } = args
  using db = openDb()
  using query = db.query(`INSERT INTO relay_state
    ( relay_state, email, timestamp, used )
    VALUES (
      $relayState,
      $email,
      $timestamp,
      $used
    );`)
  query.run({
    relayState,
    email,
    timestamp: Date.now(),
    used: 0,
  })
}

export const consumeRelayState = (args: { relayState: string }): r.Result<RelayState> => {
  const { relayState } = args
  using db = openDb()
  using query = db.query(`SELECT relay_state, email, timestamp, used
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

init()
