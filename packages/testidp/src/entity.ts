import * as z from "zod"

export const idpUserParser = z.object({
  email: z.string().email(),
  connectionId: z.string(),
})
export type IdpUser = z.infer<typeof idpUserParser>
