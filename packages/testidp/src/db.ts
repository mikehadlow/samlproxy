import { createDb, createSpConnectionTable } from "common/db"
import { Database } from "bun:sqlite"
import { initializeConnections } from "./connection"

export const initDb = (): Database => {
  const con = createDb([createSpConnectionTable])
  initializeConnections(con)
  return con
}
