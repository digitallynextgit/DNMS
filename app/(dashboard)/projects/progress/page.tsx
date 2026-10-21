"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Download, Gauge, TrendingUp } from "lucide-react"

import { DeliverablesReportDialog } from "@/features/projects/components/deliverables-report-dialog"
import { DeliveryScoresView } from "@/features/projects/components/delivery-scores-view"
import { WorkReportMenu } from "@/features/work-reports"
import type { ProgressFilterState } from "@/features/projects/components/my-progress"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PageHeader } from "@/components/shared/page-header"
import { TabsBar } from "@/components/shared/tabs-bar"
import { Tabs } from "@/components/ui/tabs"
import { replaceUrlParams, useUrlState } from "@/hooks/use-url-state"
import {
  DateRangeField,
  presetValue,
  type DateRangeValue,
} from "@/components/shared/date-range-field"
import { Button } from "@/components/ui/button"
import { ProgressSkeleton } from "@/features/projects/components/progress-skeleton"
import { PERMISSIONS } from "@/lib/constants"

// Progress (deliverables done, still to do, overdue) and Team Performance (one delivery score per
// person and team) on one page. Both are scoped server-side: admin, account manager, team manager,
// member - and the panels build their filters from the answer.

// Recharts measures the DOM, so the panel is client-only.
const MyProgress = dynamic(
  () => import("@/features/projects/components/my-progress").then((m) => m.MyProgress),
  { ssr: false, loading: () => <ProgressSkeleton /> },
)

const DAY = /^\d{4}-\d{2}-\d{2}$/

const DESCRIPTION = {
  progress: "What is still to do, what is completed, and what is overdue - by deliverable.",
  performance:
    "One delivery score per person and team for the month - goals, deliverables and tasks on time - always with what it is made of. Click a row for the items behind it.",
}

export default function ProjectProgressPage() {
  const { can, isLoading: permsLoading } = usePermissions()
  // ?tab=performance opens Team Performance (its old address redirects here).
  const [tab, setTab] = useUrlState("tab", "progress")
  const onPerformance = tab === "performance"
  // Deliverables are planned by the week. Owned here so the panel and the Slides deck share it.
  const [range, setRange] = useState<DateRangeValue>(() => presetValue("week"))
  // A link can name the dates (?from=&to=), e.g. the weekly digest's last week.
  const searchParams = useSearchParams()
  const linkFrom = searchParams.get("from")
  const linkTo = searchParams.get("to")
  const linked =
    linkFrom && linkTo && DAY.test(linkFrom) && DAY.test(linkTo) && linkFrom <= linkTo
      ? `${linkFrom}_${linkTo}`
      : null
  const [appliedLink, setAppliedLink] = useState<string | null>(null)
  if (linked !== appliedLink) {
    setAppliedLink(linked)
    if (linked) setRange({ preset: "custom", from: linkFrom, to: linkTo })
  }
  const pickRange = (next: DateRangeValue) => {
    setRange(next)
    // A hand-picked range replaces the linked one, so a reload keeps the pick.
    if (linked) replaceUrlParams({ from: null, to: null })
  }
  const [exportOpen, setExportOpen] = useState(false)
  const [filters, setFilters] = useState<ProgressFilterState | null>(null)

  const title = "Progress & Performance"
  const description = onPerformance ? DESCRIPTION.performance : DESCRIPTION.progress

  // The scope is a permission decision, and during a client-side navigation the session has not
  // resolved yet - `can()` answers false for a beat.
  if (permsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={title} description={description} />
        <ProgressSkeleton />
      </div>
    )
  }

  const managesProjects = can(PERMISSIONS.PROJECT_WRITE)

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          // The date range, reports and export belong to Progress; Team Performance has its own month.
          onPerformance ? undefined : (
            <>
              <DateRangeField value={range} onChange={pickRange} />
              {/* Same range, people and project as the page below. */}
              <WorkReportMenu
                from={range.from}
                to={range.to}
                employeeIds={filters?.peopleIds ?? []}
                projectIds={
                  filters?.projectId && filters.projectId !== "all" ? [filters.projectId] : []
                }
                whoLabel={filters?.personLabel}
              />
              <Button className="gap-1.5" variant="outline" onClick={() => setExportOpen(true)}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </>
          )
        }
      />

      <Tabs value={onPerformance ? "performance" : "progress"} onValueChange={setTab}>
        <TabsBar
          items={[
            {
              value: "progress",
              label: managesProjects ? "Progress" : "My Progress",
              icon: TrendingUp,
            },
            {
              value: "performance",
              label: managesProjects ? "Team Performance" : "My Delivery Score",
              icon: Gauge,
            },
          ]}
        />
      </Tabs>

      {onPerformance ? (
        <DeliveryScoresView />
      ) : (
        <>
          <MyProgress range={range} onFilterChange={setFilters} />
          <DeliverablesReportDialog
            open={exportOpen}
            onOpenChange={setExportOpen}
            range={range}
            projectId={
              filters?.projectId && filters.projectId !== "all" ? filters.projectId : undefined
            }
            teamIds={filters?.teamIds}
            employeeId={
              filters?.personId && filters.personId !== "all" ? filters.personId : undefined
            }
            filterSummary={filters ?? undefined}
          />
        </>
      )}
    </div>
  )
}
