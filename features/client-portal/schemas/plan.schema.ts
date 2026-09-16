import { z } from "zod"

// =============================================================================
// What the portal may send about a content plan.
//
// Deliberately narrower than the staff equivalent. A client says what they want
// and when; everything else about a row - who makes it, WHICH TEAM makes it,
// hours, the goal it serves - is the team's to decide and is not accepted here
// at all, so a hand-built request cannot set it either.
// =============================================================================

/** yyyy-MM-dd, the shape the date picker and the period helpers both speak. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

const planLineSchema = z.object({
  /** "Reel", "Blog", "Banner" - matched case-insensitively against what the project already uses. */
  type: z.string().trim().min(1, "Say what kind of thing this is").max(40),
  title: z.string().trim().min(1, "Give it a title").max(200),
  /** "10 product pages" is one line. Every count sums this. */
  quantity: z.number().int().min(1).max(999).default(1),
  /**
   * The brief: what the client actually wants, in their own words. Optional,
   * because a clear title is often the whole request.
   */
  description: z.string().trim().max(2000).optional().or(z.literal("")),
})

export const clientPlanCreateSchema = z.object({
  periodStart: day,
  periodEnd: day,
  lines: z.array(planLineSchema).min(1, "Add at least one thing to the plan").max(60),
})
export type ClientPlanCreateInput = z.infer<typeof clientPlanCreateSchema>

/**
 * Attaching finished work: a pasted link, or nothing here and a file uploaded
 * through the multipart route instead. Both land in the same place.
 */
export const clientPlanLinkSchema = z.object({
  link: z.string().trim().min(1, "Paste a link").max(2000),
})
export type ClientPlanLinkInput = z.infer<typeof clientPlanLinkSchema>

/**
 * Moving one item to another state.
 *
 * The portal is a tracker, not an approval queue: the client records where the
 * work has got to, and does not pass a verdict on it. ACCEPTED and REJECTED are
 * therefore absent here AND from the client's side of the transition table -
 * belt and braces, because this schema guards the shape while that table guards
 * the rule.
 *
 * A reason is required for STUCK and DISCARDED and refused nowhere: "blocked"
 * or "dropped" with nothing said is a row nobody can act on. Which transitions
 * demand one is decided by `allowedTransition`, not here - this only carries it.
 */
export const clientPlanStatusSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "DELIVERED", "STUCK", "DISCARDED"]),
  reason: z.string().trim().max(1000).optional().or(z.literal("")),
})
export type ClientPlanStatusInput = z.infer<typeof clientPlanStatusSchema>
