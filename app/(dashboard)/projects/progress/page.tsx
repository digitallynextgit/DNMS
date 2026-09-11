"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Presentation } from "lucide-react"

import { DeliverablesReportDialog } from "@/features/projects/components/deliverables-report-dialog"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PageHeader } from "@/components/shared/page-header"
import {
  DateRangeField,
  presetValue,
  type DateRangeValue,
} from "@/components/shared/date-range-field"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  { ssr: false, loading: () => <Skeleton className="h-64 rounded-sm" /> },
)

export default function ProjectProgressPage() {
  const { can, isLoading: permsLoading } = usePermissions()
  // Deliverables are planned by the week, so the week is the natural window:
  // what is owed now, including the days still ahead. Owned here and picked in
  // the header, next to Slides, so the panel and the deck read the same window.
  const [range, setRange] = useState<DateRangeValue>(() => presetValue("week"))
  const [slidesOpen, setSlidesOpen] = useState(false)

  // The title is a permission decision, and during a client-side navigation
  // the session has not resolved yet - `can()` answers false for a beat.
  if (permsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-sm" />
        <Skeleton className="h-24 rounded-sm" />
        <Skeleton className="h-64 rounded-sm" />
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
            <Button className="gap-1.5" variant="outline" onClick={() => setSlidesOpen(true)}>
              <Presentation className="h-3.5 w-3.5" />
              Slides
            </Button>
          </>
        }
      />
      <MyProgress range={range} />
      <DeliverablesReportDialog open={slidesOpen} onOpenChange={setSlidesOpen} range={range} />
    </div>
  )
}
