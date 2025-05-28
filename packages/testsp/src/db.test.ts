import * as db from "./db"
import { expect, test, describe } from "bun:test"

describe("db", () => {
  test("recordRelayState should insert, readRelayState should return the same", () => {
    const args = {
      relayState: crypto.randomUUID(),
      email: "joe@blogs.com",
    }

    // write the relayState
    db.recordRelayState(args)

    // read back the relayState
    const result = db.readRelayState(args)

    // assert that the relayState is correct
    expect(result).not.toBeNull()
    if(!result) throw Error("expected not null here")
    expect(result.relay_state).toEqual(args.relayState)
    expect(result.email).toEqual(args.email)
    expect(result.timestamp).toBeNumber()
    expect(result.used).toEqual(0)

    // try to read the relayState a second time
    const result2 = db.readRelayState(args)

    // assert that nothing is returned a second time
    // because the relayState has been used
    expect(result2).toBeNull()
  })
})
