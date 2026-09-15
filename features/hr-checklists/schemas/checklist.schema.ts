import { z } from "zod"

/** Which of the two processes. */
export const checklistKindSchema = z.enum(["ONBOARDING", "EXIT"])
export type ChecklistKindInput = z.infer<typeof checklistKindSchema>

/** Start a checklist by hand (the automatic paths do not go through this). */
export const startChecklistSchema = z.object({
  employeeId: z.string().uuid("Choose an employee"),
  kind: checklistKindSchema,
})
export type StartChecklistInput = z.infer<typeof startChecklistSchema>

/**
 * Tick or untick an item.
 *
 * `done` is explicit rather than a toggle: two people on the same checklist
 * would otherwise flip each other's work, and the client already knows the
 * state it is trying to reach.
 */
export const setItemDoneSchema = z.object({
  done: z.boolean(),
  /** What the signer wrote - "laptop returned, asset tag DN-114". */
  note: z.string().trim().max(500).optional().or(z.literal("")),
})
export type SetItemDoneInput = z.infer<typeof setItemDoneSchema>

/** Hand one item to a named person - a stand-in while a head is away. */
export const reassignItemSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
})
export type ReassignItemInput = z.infer<typeof reassignItemSchema>

/**
 * Add an item to a live checklist.
 *
 * Exists mainly for the document's "other departments worked with": that is one
 * clearance per department the leaver actually touched, which is knowable only
 * once you know who is leaving.
 */
export const addItemSchema = z.object({
  sectionTitle: z.string().trim().min(1, "Which step does this belong to?").max(120),
  text: z.string().trim().min(2, "Describe the item").max(300),
  helpText: z.string().trim().max(500).optional().or(z.literal("")),
  itemKind: z.enum(["TASK", "CLEARANCE"]).default("TASK"),
  assigneeId: z.string().uuid().nullable().optional(),
  isRequired: z.boolean().default(true),
  /** "yyyy-MM-dd". Blank means no date. */
  dueDate: z.string().trim().optional().or(z.literal("")),
})
export type AddItemInput = z.infer<typeof addItemSchema>
export type AddItemFormInput = z.input<typeof addItemSchema>

export const cancelChecklistSchema = z.object({
  reason: z.string().trim().max(300).optional().or(z.literal("")),
})
export type CancelChecklistInput = z.infer<typeof cancelChecklistSchema>

/** Filters for the HR list screens. */
export const checklistListQuerySchema = z.object({
  kind: checklistKindSchema,
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED", "ALL"]).default("IN_PROGRESS"),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ChecklistListQuery = z.infer<typeof checklistListQuerySchema>
