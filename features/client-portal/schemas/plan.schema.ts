import { z } from "zod"

// Narrower than the staff schema: who makes it, which team, hours and goal are not accepted here.

/** yyyy-MM-dd, the shape the date picker and the period helpers both speak. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

const planLineSchema = z.object({
  /** "Reel", "Blog", "Banner" - matched case-insensitively against what the project already uses. */
  type: z.string().trim().min(1, "Say what kind of thing this is").max(40),
  title: z.string().trim().min(1, "Give it a title").max(200),
  /** "10 product pages" is one line. Every count sums this. */
  quantity: z.number().int().min(1).max(999).default(1),
  /** The client's brief. Optional - a clear title is often the whole request. */
  description: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const clientPlanCreateSchema = z.object({
  periodStart: day,
  periodEnd: day,
  lines: z.array(planLineSchema).min(1, "Add at least one thing to the plan").max(60),
})
export type ClientPlanCreateInput = z.infer<typeof clientPlanCreateSchema>

/** A pasted link; files go through the multipart route instead. */
export const clientPlanLinkSchema = z.object({
  link: z.string().trim().min(1, "Paste a link").max(2000),
})
export type ClientPlanLinkInput = z.infer<typeof clientPlanLinkSchema>

/**
 * Moving one item to another state. No ACCEPTED/REJECTED - the portal tracks work, it doesn't
 * approve it. Which moves need a reason is decided by allowedTransition.
 */
export const clientPlanStatusSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "DELIVERED", "STUCK", "DISCARDED"]),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type ClientPlanStatusInput = z.infer<typeof clientPlanStatusSchema>
