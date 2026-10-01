import type { Metadata } from "next"

import { WorkReportClient } from "@/features/work-reports"

export const metadata: Metadata = { title: "Work Report" }

// Routing glue only (CLAUDE.md rule #1): the feature owns the logic.
export default function WorkReportsPage() {
  return <WorkReportClient />
}
