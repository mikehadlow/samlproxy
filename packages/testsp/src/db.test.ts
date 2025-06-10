import { recordRelayState, consumeRelayState, createUser, getUser, spPrivateTables } from "./db"
import { createDb } from "common/db"
import { expect, test, describe } from "bun:test"
import * as r from "common/result"

describe("db", () => {
  test("recordRelayState should insert, consumeRelayState should return the same", () => {
    const args = {
      relayState: crypto.randomUUID(),
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
})
