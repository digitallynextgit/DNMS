import { z } from "zod"
import { WEB_CHECKLIST_STATUSES } from "../lib/web-checklist-template"

export const webChecklistItemPatchSchema = z
  .object({
    status: z.enum(WEB_CHECKLIST_STATUSES).optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.note !== undefined, { message: "Nothing to change" })

export type WebChecklistItemPatch = z.infer<typeof webChecklistItemPatchSchema>
