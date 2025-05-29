import * as db from "./db"
import { expect, test, describe } from "bun:test"
import * as r from "common/result"

describe("db", () => {
  test("recordRelayState should insert, consumeRelayState should return the same", () => {
    const args = {
      relayState: crypto.randomUUID(),
      email: "joe@blogs.com",
    }

    // write the relayState
    db.recordRelayState(args)

    // read back the relayState
    const result = db.consumeRelayState(args)

    // assert that the relayState is correct
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw Error("expected OK here!") // irritating need for type coeertion
    expect(result.value.relay_state).toEqual(args.relayState)
    expect(result.value.email).toEqual(args.email)
    expect(result.value.timestamp).toBeNumber()
    expect(result.value.used).toEqual(0)

    // try to read the relayState a second time
    const result2 = db.consumeRelayState(args)

    // assert failure a second time
    // because the relayState has been used
    expect(r.isFail(result2)).toBeTrue()
  })
})
