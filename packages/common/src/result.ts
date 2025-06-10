export type Fail = {
  type: "fail",
  message: string | Error,
}

export type Ok<T> = {
  type: "ok",
  value: T,
}

export type Result<T> = Ok<T> | Fail

export type VoidResult = Result<Record<string, never>>

// constructors
export const from = <T>(value: T): Ok<T> => ({ type: "ok", value, })
export const fail = (message: string | Error): Fail => ({ type: "fail", message })
export const voidResult: VoidResult = from({})

// composition
export const bind = <A, B>(a: Result <A>, func: (a: A) => Result<B>): Result<B> => {
  if (isFail(a)) {
    return a
  }
  try {
    return func(a.value)
  }
  catch (e: unknown) {
    if (e instanceof Error) {
      return fail(e)
    }
    else {
      return fail(new Error(`Error: ${e}`))
    }
  }
}

// validate can be used to validate a previous result, but still return the previous OK value
export const validate = <A>(a: Result<A>, func: (a: A) => VoidResult): Result<A> => {
  const result = bind(a, func)
  return isOk(result) ? a : result
}

export const map = <A, B>(a: Result<A>, func: (a: A) => B): Result<B> => bind(a, x => from(func(x)))

// run some void returning function in the context of the result (useful for logging etc)
export const run = <A>(a: Result<A>, func: (a: A) => void): Result<A> => {
  map(a, func)
  return a
}

// run a function and return a result. This has the effect of turning any errors
// into Fail types
export const attempt = <A>(func: () => A): Result<A> =>  map(from(true), func)

export const merge2 = <A, B>(a: Result<A>, b: Result<B>): Result<{ a: A, b: B }> =>
  isFail(a) ? a
  : isFail(b) ? b
  : from({ a: a.value, b: b.value })

export const merge3 = <A, B, C>(a: Result<A>, b: Result<B>, c: Result<C>): Result<{ a: A, b: B, c: C }> =>
  isFail(a) ? a
  : isFail(b) ? b
  : isFail(c) ? c
  : from({ a: a.value, b: b.value, c: c.value })


// async composition
export const bindAsync = async <A, B>(a: Result<A>, func: (a: A) => Promise<Result<B>>): Promise<Result<B>> => {
  if (isFail(a)) {
    return a
  }
  try {
    return func(a.value)
  }
  catch (e: unknown) {
    if (e instanceof Error) {
      return fail(e)
    }
    else {
      return fail(new Error(`Error: ${e}`))
    }
  }
}

export const mapAsync = async <A, B>(a: Result<A>, func: (a: A) => Promise<B>): Promise<Result<B>> =>
  bindAsync(a, async x => from(await func(x)))

// validate can be used to validate a previous result, but still return the previous OK value
export const validateAsync = async <A>(a: Result<A>, func: (a: A) => Promise<VoidResult>): Promise<Result<A>> => {
  const result = await bindAsync(a, func)
  return isOk(result) ? a : result
}

// type narrowing
export const isOk = <T>(result: Result<T>): result is Ok<T> => result.type === "ok"
export const isFail = <T>(result: Result<T>): result is Fail => result.type === "fail"
