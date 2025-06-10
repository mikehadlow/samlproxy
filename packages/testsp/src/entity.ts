import * as z from "zod"

export const spUserParser = z.object({
  email: z.string().email(),
  idpEntityId: z.string(),
})
export type SpUser = z.infer<typeof spUserParser>
