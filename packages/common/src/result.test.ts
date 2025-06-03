import * as r from "./result"
import { expect, test, describe } from "bun:test"

describe("result", () => {
  test("from should create result", () => {
    const expected = "Hello World!"
    const result = r.from(expected)
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here?")
    }
    expect(result.value).toEqual(expected)
  })

  test("bind should chain ok values", () => {
    const a = r.from(10)
    const func = (a: number): r.Result<string> => r.from(a.toString())
    const result = r.bind(a, func)
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here?")
    }
    expect(result.value).toEqual("10")
  })

  test("bind should pass through fail values", () => {
    const message = "Oh no!"
    const a = r.fail(message)
    const func = (a: number): r.Result<string> => r.from(a.toString())
    const result = r.bind(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here?")
    }
    expect(result.message).toEqual(message)
  })

  test("bind should catch errors and convert to Fail type", () => {
    const a = r.from(72)
    const error = new Error("Oh no!!")
    const func = (_: number): r.Result<string> => { throw error }
    const result = r.bind(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here?")
    }
    expect(result.message).toEqual(error)
  })

  test("validate should pass though a success value", () => {
    const a = r.from(72)
    const func = (_:number): r.VoidResult => r.voidResult
    const result = r.validate(a, func)
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here")
    }
    expect(result.value).toEqual(72)
  })

  test("validate should pass though a fail message", () => {
    const a = r.fail("Oh no!")
    const func = (_:number): r.VoidResult => r.voidResult
    const result = r.validate(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here")
    }
    expect(result.message).toEqual("Oh no!")
  })

  test("validate should return validation failure", () => {
    const a = r.from(72)
    const func = (_:number): r.VoidResult => r.fail("Terrible!!")
    const result = r.validate(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here")
    }
    expect(result.message).toEqual("Terrible!!")
  })

  test("map should hoist function", () => {
    const a = r.from(10)
    const result = r.map(a, x => x.toString())
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here?")
    }
    expect(result.value).toEqual("10")
  })

  test("bindAsync should chain ok values", async () => {
    const a = r.from(10)
    const func = async (a: number): Promise<r.Result<string>> => Promise.resolve(r.from(a.toString()))
    const result = await r.bindAsync(a, func)
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here?")
    }
    expect(result.value).toEqual("10")
  })

  test("bindAsync should pass through fail values", async () => {
    const message = "Oh no!"
    const a = r.fail(message)
    const func = (a: number): Promise<r.Result<string>> => Promise.resolve(r.from(a.toString()))
    const result = await r.bindAsync(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here?")
    }
    expect(result.message).toEqual(message)
  })

  test("bindAsync should catch errors and convert to Fail type", async () => {
    const a = r.from(72)
    const error = new Error("Oh no!!")
    const func = (_: number): Promise<r.Result<string>> => { throw error }
    const result = await r.bindAsync(a, func)
    expect(result.type).toEqual("fail")
    if (r.isOk(result)) {
      throw new Error("Should be Fail here?")
    }
    expect(result.message).toEqual(error)
  })

  test("mapAsync should hoist function", async () => {
    const a = r.from(10)
    const result = await r.mapAsync(a, x => Promise.resolve(x.toString()))
    expect(result.type).toEqual("ok")
    if (r.isFail(result)) {
      throw new Error("Should be Ok here?")
    }
    expect(result.value).toEqual("10")
  })
})
