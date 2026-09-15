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
 * The verdict on one delivered item.
 *
 * A reason is required to send something back and optional to finalise it, for
 * the same reason it is on a document review: "not this one" is useless to the
 * person who made it without saying why, while "yes" explains itself.
 */
export const clientPlanDecisionSchema = z
  .object({
    decision: z.enum(["FINALISE", "REQUEST_CHANGES"]),
    reason: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((v) => v.decision === "FINALISE" || Boolean(v.reason?.trim()), {
    message: "Say what needs changing",
    path: ["reason"],
  })
export type ClientPlanDecisionInput = z.infer<typeof clientPlanDecisionSchema>
