import { expect, test, describe } from "bun:test"
import * as r from "common/result"
import * as db from "./db"
import * as e from "./entity"

describe("db", () => {
  test("snakeToCamel should work", () => {
    const input = {
      hello_world: "Hello World",
      a_number: 123,
    }
    const expected = {
      helloWorld: input.hello_world,
      aNumber: input.a_number,
    }
    expect(db.snakeToCamel(input)).toEqual(expected)
  })

  test("intsToBools should work", () => {
    const input = {
      one: 1,
      two: 0,
      three: "Hello",
    }
    const expected = {
      one: true,
      two: false,
      three: "Hello",
    }
    expect(db.intsToBools(input, ["one", "two"])).toEqual(expected)
  })

  test("boolsToInts should work", () => {
    const input = {
      one: true,
      two: false,
      three: "Hello",
    }
    const expected = {
      one: 1,
      two: 0,
      three: "Hello",
    }
    expect(db.boolsToInts(input)).toEqual(expected)
  })

  test("insert and select sp_connection should work", () => {
    const connection: e.SpConnection = {
      id: crypto.randomUUID(),
      name: "Some SP Name",
      idpEntityId: "some-IdP-entity-id",
      idpSsoUrl: "https://example-idp.com/sso",
      privateKey: "some-long-string-lets-make-this-really-long",
      privateKeyPassword: "a-password",
      signingCertificate: "some-other-long-string-lets-make-this-really-long",
      spEntityId: "some-SP-entity-id",
      spAcsUrl: "https://example-sp/acs",
    }
    const con = db.createDb([db.createSpConnectionTable])
    db.insertSpConnection(con, connection)
    const result = db.getSpConnection(con, connection)
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw new Error("type coertion")
    expect(result.value).toEqual(connection)

    const result2 = db.getSpConnectionById(con, connection)
    expect(r.isOk(result2)).toBeTrue()
    if(r.isFail(result2)) throw new Error("type coertion")
    expect(result2.value).toEqual(connection)

    const result3 = db.getAllSpConnections(con)
    expect(result3.length).toBe(1)
    expect(result3[0]).toEqual(connection)
  })

  test("insert and select idp_connection should work", () => {
    const connection: e.IdpConnection = {
      id: crypto.randomUUID(),
      name: "Some IdP Name",
      signingCertificate: "some-long-string-lets-make-this-really-long",
      spEntityId: "some-SP-entity-id",
      spAcsUrl: "https://example-sp/acs",
      spAllowIdpInitiated: true,
      idpEntityId: "some-IdP-entity-id",
      idpSsoUrl: "https://example-idp.com/sso",
    }
    const con = db.createDb([db.createIdpConnectionTable])

    db.insertIdpConnection(con, connection)

    const result = db.getIdpConnection(con, connection)
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw new Error("type coertion")
    expect(result.value).toEqual(connection)
  })
})
