import type { Metadata } from "next"

import { WorkReportClient } from "@/features/work-reports"

export const metadata: Metadata = { title: "Work Report" }

export default function WorkReportsPage() {
  return <WorkReportClient />
}
