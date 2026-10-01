import "server-only"

import { WORK_REPORT_CONTENT_TYPES } from "../constants"
import { reportFilename, type ReportPeriod } from "../lib/report-format"
import type { BuiltWorkReport, WorkReportFormat } from "../types"
import { polishWorkReport } from "./work-report.ai"
import { loadWorkReport } from "./work-report.queries"
import { renderWorkReportDocx } from "./render/docx"
import { PdfCanvas } from "./render/pdf-canvas"
import { PptxCanvas } from "./render/pptx-canvas"
import { renderSlides } from "./render/slides"

export interface BuildWorkReportInput {
  requesterId: string
  /** Already narrowed to the requester's scope. */
  employeeIds: string[]
  period: ReportPeriod
  format: WorkReportFormat
  ai: boolean
  now?: Date
}

/** Load, optionally polish, and render one work report file. */
export async function buildWorkReport(input: BuildWorkReportInput): Promise<BuiltWorkReport> {
  const report = await loadWorkReport({
    employeeIds: input.employeeIds,
    period: input.period,
    requesterId: input.requesterId,
    now: input.now,
  })
  if (input.ai) await polishWorkReport(report)

  const meta = {
    title: `${report.title} - ${report.period.label} work report`,
    author: report.preparedBy.name || "DNMS",
  }
  let bytes: Uint8Array<ArrayBuffer>
  if (input.format === "docx") {
    bytes = await renderWorkReportDocx(report)
  } else {
    const canvas = input.format === "pdf" ? new PdfCanvas(meta) : new PptxCanvas(meta)
    renderSlides(canvas, report)
    bytes = await canvas.finish()
  }
  return {
    bytes,
    filename: reportFilename(report.period.label, report.title, input.format),
    contentType: WORK_REPORT_CONTENT_TYPES[input.format],
  }
}
