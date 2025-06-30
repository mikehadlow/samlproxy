import { recordRelayState, consumeRelayState, createUser, getUser, spPrivateTables, getAllUsersAndConnections } from "./db"
import { initializeDb } from "./connection"
import { createDb, createIdpConnectionTable } from "common/db"
import { expect, test, describe } from "bun:test"
import * as r from "common/result"

describe("db", () => {
  test("recordRelayState should insert, consumeRelayState should return the same", () => {
    const args = {
      relayState: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      email: "joe@blogs.com",
    }
    const con = createDb([spPrivateTables])

    // write the relayState
    recordRelayState(con, args)

    // read back the relayState
    const result = consumeRelayState(con, args)

    // assert that the relayState is correct
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw new Error("expected OK here!") // irritating need for type coeertion
    expect(result.value.relay_state).toEqual(args.relayState)
    expect(result.value.request_id).toEqual(args.requestId)
    expect(result.value.email).toEqual(args.email)
    expect(result.value.timestamp).toBeNumber()
    expect(result.value.used).toEqual(0)

    // try to read the relayState a second time
    const result2 = consumeRelayState(con, args)

    // assert failure a second time
    // because the relayState has been used
    expect(r.isFail(result2)).toBeTrue()
  })

  test("createUser should create SpUser, getUser should return the same", () => {
    const args = {
      email: "joe@blogs.com",
      idpEntityId: "the-IdP-Entity-Id",
    }
    const con = createDb([spPrivateTables])

    // create the user
    createUser(con, args)

    // get the user
    const result = getUser(con, args)

    // assert that the returned user is correct
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw new Error("type coertion")
    expect(result.value).toEqual(args)
  })

  test("getAllUsersAndConnections should return all users and their connections", () => {
    const con = createDb([ spPrivateTables, createIdpConnectionTable ])
    initializeDb(con)

    // get all users and their connections
    const results = getAllUsersAndConnections(con)

    // assert that the returned users and connections are correct
    expect(results.length).toBe(2)
    expect(results).toEqual([
      { email: "joe@blogs.com", name: "Direct To IdP" },
      { email: "jane@blogs.com", name: "Via Proxy" },
    ])
  })
})
