import { z } from "zod"
import { NOTICE_PERIODS } from "../lib/fnf"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
const text = (max: number) => z.string().trim().max(max)

const fields = {
  designation: text(120).nullable().optional(),
  dueDate: day.optional(),
  releasedOn: day.nullable().optional(),
  noticePeriod: z.enum(NOTICE_PERIODS).nullable().optional(),
  relievingGiven: z.boolean().optional(),
  relievingDate: day.nullable().optional(),
  notes: text(2000).nullable().optional(),
}

/** A DNMS employee (employeeId), or a past employee entered by name. */
export const createFullFinalSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    name: text(120).optional(),
    lastWorkingDate: day,
    ...fields,
  })
  .refine((v) => v.employeeId || v.name, { message: "Enter a name", path: ["name"] })
  .refine((v) => !v.dueDate || v.dueDate >= v.lastWorkingDate, {
    message: "The FnF due date can't be before the last working day",
    path: ["dueDate"],
  })

export const updateFullFinalSchema = z.object({
  name: text(120).min(1, "Enter a name").optional(),
  lastWorkingDate: day.optional(),
  ...fields,
})

export type CreateFullFinalInput = z.infer<typeof createFullFinalSchema>
export type UpdateFullFinalInput = z.infer<typeof updateFullFinalSchema>
