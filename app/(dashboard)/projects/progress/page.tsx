"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Download } from "lucide-react"

import { DeliverablesReportDialog } from "@/features/projects/components/deliverables-report-dialog"
import type { ProgressFilterState } from "@/features/projects/components/my-progress"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PageHeader } from "@/components/shared/page-header"
import {
  DateRangeField,
  presetValue,
  type DateRangeValue,
} from "@/components/shared/date-range-field"
import { Button } from "@/components/ui/button"
import { ProgressSkeleton } from "@/features/projects/components/progress-skeleton"
import { PERMISSIONS } from "@/lib/constants"

// =============================================================================
// Progress
//
// One page for everyone, shaped by what the server says they may see: an
// admin gets the whole company, an account manager the projects they own and
// every team on them, a team manager their teams and line reports, a member
// only themselves. The panel asks the server for that scope and builds its
// filters from the answer, so the page itself has nothing to decide beyond
// the title. Goals and tasks are deliberately off this page for now; the work
// is measured by deliverables.
// =============================================================================

// Recharts measures the DOM, so the panel is client-only.
const MyProgress = dynamic(
  () => import("@/features/projects/components/my-progress").then((m) => m.MyProgress),
  { ssr: false, loading: () => <ProgressSkeleton /> },
)

export default function ProjectProgressPage() {
  const { can, isLoading: permsLoading } = usePermissions()
  // Deliverables are planned by the week, so the week is the natural window:
  // what is owed now, including the days still ahead. Owned here and picked in
  // the header, next to Slides, so the panel and the deck read the same window.
  const [range, setRange] = useState<DateRangeValue>(() => presetValue("week"))
  const [exportOpen, setExportOpen] = useState(false)
  const [filters, setFilters] = useState<ProgressFilterState | null>(null)

  // The title is a permission decision, and during a client-side navigation
  // the session has not resolved yet - `can()` answers false for a beat.
  if (permsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Progress"
          description="What is still to do, what is completed, and what is overdue - by deliverable."
        />
        <ProgressSkeleton />
      </div>
    )
  }

  const managesProjects = can(PERMISSIONS.PROJECT_WRITE)

  return (
    <div className="space-y-6">
      <PageHeader
        title={managesProjects ? "Progress" : "My Progress"}
        description="What is still to do, what is completed, and what is overdue - by deliverable."
        actions={
          <>
            <DateRangeField value={range} onChange={setRange} />
            <Button className="gap-1.5" variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </>
        }
      />
      <MyProgress range={range} onFilterChange={setFilters} />
      <DeliverablesReportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        range={range}
        projectId={filters?.projectId && filters.projectId !== "all" ? filters.projectId : undefined}
        teamIds={filters?.teamIds}
        employeeId={filters?.personId && filters.personId !== "all" ? filters.personId : undefined}
        filterSummary={filters ?? undefined}
      />
    </div>
  )
}
