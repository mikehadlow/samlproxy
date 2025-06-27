import {
  recordRelayState,
  consumeRelayState,
  proxyTables,
  createLink,
  getLinkedSpEntityId,
  getLinkedIdpEntityId,
} from "./db"
import { createDb } from "common/db"
import { expect, test, describe } from "bun:test"
import * as r from "common/result"

describe("db", () => {
  test("recordRelayState should insert, consumeRelayState should return the same", () => {
    const args = {
      relayState: crypto.randomUUID(),
      spRequestId: crypto.randomUUID(),
      proxyRequestId: crypto.randomUUID(),
      spEntityId: "the-sp-entity-id",
    }
    const con = createDb([proxyTables])

    // write the relayState
    recordRelayState(con, args)

    // read back the relayState
    const result = consumeRelayState(con, args)

    // assert that the relayState is correct
    expect(r.isOk(result)).toBeTrue()
    if(r.isFail(result)) throw new Error("type coercion")
    expect(result.value.relay_state).toEqual(args.relayState)
    expect(result.value.sp_request_id).toEqual(args.spRequestId)
    expect(result.value.proxy_request_id).toEqual(args.proxyRequestId)
    expect(result.value.sp_entity_id).toEqual(args.spEntityId)
    expect(result.value.timestamp).toBeNumber()
    expect(result.value.used).toEqual(0)

    // try to read the relayState a second time
    const result2 = consumeRelayState(con, args)

    // assert failure a second time
    // because the relayState has been used
    expect(r.isFail(result2)).toBeTrue()
  })

  test("createLink should insert a connection link getLinkedSpEntityId and getLinkedIdpEntityId should return the same", () => {
    const args = {
      spEntityId: "the-sp-entity-id",
      idpEntityId: "the-idp-entity-id",
    }
    const con = createDb([proxyTables])

    // write a link
    createLink(con, args)

    // read back the IdP given the SP:
    const idpResult = getLinkedIdpEntityId(con, args)
    expect(r.isOk(idpResult)).toBeTrue()
    if(r.isFail(idpResult)) throw new Error("type coercion")
    expect(idpResult.value).toEqual(args)

    // read back the SP given the IdP
    const spResult = getLinkedSpEntityId(con, args)
    expect(r.isOk(spResult)).toBeTrue()
    if(r.isFail(spResult)) throw new Error("type coercion")
    expect(spResult.value).toEqual(args)
  })
})
