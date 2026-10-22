import { z } from "zod"
import { ACTIVITY_KINDS, STAGES } from "../lib/sales"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const text = (max: number) => z.string().trim().max(max).nullable().optional()
/** "" from a cleared input means "none". */
const blankIsNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v)

const fields = {
  contactName: text(120),
  phone: text(40),
  email: z.preprocess(
    blankIsNull,
    z.string().trim().email("That email doesn't look right").max(160).nullable().optional(),
  ),
  website: text(300),
  category: text(80),
  area: text(120),
  city: text(80),
  address: text(400),
  mapsUrl: text(600),
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewsCount: z.number().int().min(0).nullable().optional(),
  notes: text(4000),
}

export const createLeadSchema = z.object({
  business: z.string().trim().min(1, "Enter the business name").max(160),
  ...fields,
  stage: z.enum(STAGES).optional(),
  lostReason: text(300),
  value: z.number().min(0).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  nextFollowUp: day.nullable().optional(),
  doNotContact: z.boolean().optional(),
})

export const updateLeadSchema = createLeadSchema.partial()

/** Rows already mapped from a spreadsheet in the browser. */
export const importLeadsSchema = z.object({
  rows: z
    .array(z.object({ business: z.string().trim().min(1).max(160), ...fields }))
    .min(1, "There are no rows to import")
    .max(2000, "Import up to 2,000 leads at a time"),
  assigneeId: z.string().uuid().nullable().optional(),
})

export const leadActivitySchema = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  note: text(2000),
  /** Optionally move the lead on and set its next follow-up in the same step. */
  stage: z.enum(STAGES).optional(),
  nextFollowUp: day.nullable().optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>
export type LeadActivityInput = z.infer<typeof leadActivitySchema>
