import { z } from "zod"

export const checklistKindSchema = z.enum(["ONBOARDING", "EXIT"])
export type ChecklistKindInput = z.infer<typeof checklistKindSchema>

/** Start a checklist by hand (the automatic paths do not go through this). */
export const startChecklistSchema = z.object({
  employeeId: z.string().uuid("Choose an employee"),
  kind: checklistKindSchema,
})
export type StartChecklistInput = z.infer<typeof startChecklistSchema>

/** Tick or untick. An explicit `done`, not a toggle, so two people can't flip each other's work. */
export const setItemDoneSchema = z.object({
  done: z.boolean(),
  /** What the signer wrote - "laptop returned, asset tag DN-114". */
  note: z.string().trim().max(500).optional().or(z.literal("")),
})
export type SetItemDoneInput = z.infer<typeof setItemDoneSchema>

export const reassignItemSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
})
export type ReassignItemInput = z.infer<typeof reassignItemSchema>

/**
 * Add an item to a live checklist, e.g. a clearance for another department the leaver worked with.
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

export const checklistListQuerySchema = z.object({
  kind: checklistKindSchema,
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED", "ALL"]).default("IN_PROGRESS"),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ChecklistListQuery = z.infer<typeof checklistListQuerySchema>
