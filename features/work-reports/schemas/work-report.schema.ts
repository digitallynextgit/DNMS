import { z } from "zod"

import { MAX_PEOPLE_PER_REPORT, WORK_REPORT_FORMATS } from "../constants"
import { MONTH_RE } from "../lib/report-format"

/** GET /api/work-reports query string. */
export const workReportQuerySchema = z.object({
  month: z.string().regex(MONTH_RE, "month must be YYYY-MM"),
  format: z.enum(WORK_REPORT_FORMATS as [string, ...string[]]).default("pptx"),
  employeeIds: z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().uuid())
        .max(MAX_PEOPLE_PER_REPORT, `At most ${MAX_PEOPLE_PER_REPORT} people per report`),
    ),
  ai: z
    .enum(["0", "1"])
    .default("1")
    .transform((v) => v === "1"),
})

export type WorkReportQuery = z.infer<typeof workReportQuerySchema>
