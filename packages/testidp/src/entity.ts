import * as z from "zod"

export const idpUserParser = z.object({
  email: z.string().email(),
  connectionId: z.string(),
})
export type IdpUser = z.infer<typeof idpUserParser>

export const userConnectionParser = z.object({
  email: z.string().email(),
  name: z.string(),
})
export type UserConnection = z.infer<typeof userConnectionParser>
