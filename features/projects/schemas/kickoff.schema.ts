import { z } from "zod"

export const kickoffItemPatchSchema = z
  .object({
    isDone: z.boolean().optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => v.isDone !== undefined || v.note !== undefined, { message: "Nothing to change" })

export type KickoffItemPatch = z.infer<typeof kickoffItemPatchSchema>
