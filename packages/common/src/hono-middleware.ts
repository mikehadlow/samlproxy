// import { createMiddleware } from 'hono/factory'
import type { MiddlewareHandler } from 'hono'

export type ContextWithNonce = {
  Variables: {
    nonce: string;
  };
};

export const cspMiddleware = (): MiddlewareHandler<ContextWithNonce> => {
  return async (c, next) => {
    const nonce = crypto.randomUUID()
    c.set("nonce", nonce)
    const csp: [string, string][] = [
      ["default-src", "'self'"],
      ["style-src", `'nonce-${nonce}' cdn.jsdelivr.net`],
      ["script-src", `'nonce-${nonce}'`],
      ["object-src", "'none'"],
      ["base-uri", "'none'"],
      ["frame-ancestors", "'none'"],
    ]
    const cspString: string = csp.map(([key, value]) => `${key} ${value}`).join("; ")
    await next()
    c.header("Content-Security-Policy", cspString)
  }
}
