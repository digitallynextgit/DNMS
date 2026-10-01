import type { WorkReportFormat } from "./types"

export const WORK_REPORT_FORMATS: WorkReportFormat[] = ["pptx", "pdf", "docx"]

export const WORK_REPORT_FORMAT_LABELS: Record<WorkReportFormat, string> = {
  pptx: "PowerPoint",
  pdf: "PDF",
  docx: "Word",
}

export const WORK_REPORT_CONTENT_TYPES: Record<WorkReportFormat, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

/** One deck per person is a lot of slides; past this, split the request. */
export const MAX_PEOPLE_PER_REPORT = 40
