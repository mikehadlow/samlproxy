import { createUser, getUser, idpPrivateTables } from "./db"
import { createDb } from "common/db"
import { expect, test, describe } from "bun:test"
import * as r from "common/result"

describe("db", () => {
  test("createUser should create IdpUser, getUser should return the same", () => {
    const args = {
      email: "joe@blogs.com",
      connectionId: "the-connection-id",
    }
    const con = createDb([idpPrivateTables])

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
