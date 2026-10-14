import { z } from "zod"

import { MAX_PEOPLE_PER_REPORT, WORK_REPORT_FORMATS } from "../constants"
import { DATE_RE, MONTH_RE } from "../lib/report-format"

const idList = (max: number, what: string) =>
  z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).max(max, `At most ${max} ${what} per report`))

/** GET /api/work-reports query string: a `month`, or a `from`-`to` range (this week, custom). */
export const workReportQuerySchema = z.object({
  month: z.string().regex(MONTH_RE, "month must be YYYY-MM").optional(),
  from: z.string().regex(DATE_RE, "from must be YYYY-MM-DD").optional(),
  to: z.string().regex(DATE_RE, "to must be YYYY-MM-DD").optional(),
  /** Only these projects' tasks and deliverables; empty = every project. */
  projectIds: idList(50, "projects"),
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
