import { createDb, createSpConnectionTable, createIdpConnectionTable } from "common/db"
import { Database } from "bun:sqlite"
import { initializeConnections } from "./connection"

export const initDb = (): Database => {
  const con = createDb([createSpConnectionTable, createIdpConnectionTable])
  initializeConnections(con)
  return con
}
