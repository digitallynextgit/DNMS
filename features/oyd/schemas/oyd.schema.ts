import { z } from "zod"
import { OYD_CATEGORY_KEYS, OYD_NOTE_MAX } from "../constants"

export const raiseFlagSchema = z.object({
  employeeId: z.string().min(1, { message: "Pick who the flag is for" }),
  category: z.enum(OYD_CATEGORY_KEYS as [string, ...string[]]),
  note: z
    .string()
    .trim()
    .min(5, { message: "Say what was delayed and how it affected the work" })
    .max(OYD_NOTE_MAX),
})

/** Reject needs a reason so the raiser knows why; remove takes an optional one. */
export const flagActionSchema = z
  .object({
    action: z.enum(["confirm", "reject", "remove"]),
    note: z.string().trim().max(OYD_NOTE_MAX).optional(),
  })
  .refine((v) => v.action !== "reject" || Boolean(v.note), {
    message: "Say why the flag isn't confirmed",
    path: ["note"],
  })

export type RaiseFlagInput = z.infer<typeof raiseFlagSchema>
export type FlagActionInput = z.infer<typeof flagActionSchema>
