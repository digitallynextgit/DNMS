import { z } from "zod"

export const IMPACT_MAX_LENGTH = 2000

const weekKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "week must be YYYY-MM-DD" })
  .refine((s) => new Date(`${s}T00:00:00Z`).getUTCDay() === 1, {
    message: "week must be a Monday",
  })

/** One person's week across clients (My Tasks), or one project's week across people (Tasks tab). */
export const weeklyImpactQuerySchema = z
  .object({
    week: weekKey,
    employeeId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
  })
  .refine((q) => Boolean(q.employeeId) !== Boolean(q.projectId), {
    message: "Pass either employeeId or projectId",
  })

/** projectId null is the Adhoc row. An empty note clears it. */
export const weeklyImpactSchema = z.object({
  week: weekKey,
  employeeId: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  note: z.string().trim().max(IMPACT_MAX_LENGTH),
})

export type WeeklyImpactInput = z.infer<typeof weeklyImpactSchema>
