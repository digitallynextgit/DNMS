import { z } from "zod"
import { CHANNELS, GOOD_WHEN, UNITS } from "../lib/metrics"

const week = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a week")
const text = (max: number) => z.string().trim().max(max).nullable().optional()
/** "" from a cleared input means "none". */
const blankIsNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v)
const num = z.preprocess(blankIsNull, z.number().finite().nullable().optional())

export const createMetricSchema = z.object({
  channel: z.enum(CHANNELS),
  name: z.string().trim().min(1, "Name the metric").max(120),
  unit: z.enum(UNITS).default("NUMBER"),
  howTo: text(600),
  healthyMin: num,
  healthyMax: num,
  goodWhen: z.enum(GOOD_WHEN).default("UP"),
  healthyNote: text(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
})

export const updateMetricSchema = createMetricSchema.partial()

/** One week's numbers, saved in a single pass so a half-filled scorecard is never written. */
export const saveEntriesSchema = z.object({
  weekStart: week,
  values: z
    .array(
      z.object({
        metricId: z.string().uuid(),
        value: num,
        note: text(300),
      }),
    )
    .min(1, "There is nothing to save")
    .max(200),
})

export type CreateMetricInput = z.infer<typeof createMetricSchema>
export type UpdateMetricInput = z.infer<typeof updateMetricSchema>
export type SaveEntriesInput = z.infer<typeof saveEntriesSchema>
