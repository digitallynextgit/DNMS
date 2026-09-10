"use client"

import * as React from "react"
import { PackageCheck } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { UNPLANNED_KEY, UNPLANNED_LABEL, periodKeyFromSlug } from "../lib/deliverable-periods"
import { formatPeriod } from "../lib/delivery-period"
import { DeliverablesTab } from "./deliverables-tab"

/** The key carries yyyy-MM-dd..yyyy-MM-dd; the formatter wants Dates. */
const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)
const labelOf = (key: string) => {
  const [start, end] = key.split("..")
  return start && end ? formatPeriod(day(start), day(end)) : key
}

/**
 * One deliverable on its own page.
 *
 * The board lists the periods; the eye on a row lands here, where the lines
 * are shown in full with every action on them - assign, log delivery, accept -
 * instead of folded under the row. It is the board component underneath,
 * narrowed to one key, so the permissions and the dialogs are the board's and
 * not a second copy that could drift.
 */
export function DeliverablePeriodPage({
  projectId,
  periodSlug,
  canManage,
  currentUserId,
  projectName,
}: {
  projectId: string
  /** The window as it appears in the URL - see `periodSlug()`. */
  periodSlug: string
  canManage: boolean
  currentUserId: string
  projectName?: string
}) {
  const key = periodKeyFromSlug(periodSlug)
  const back = `/projects/${projectId}?tab=deliverables`

  // The title IS the period - read straight off the URL, so it is right
  // before any data arrives and never says "Deliverable" as a placeholder.
  const label = key === null ? null : key === UNPLANNED_KEY ? UNPLANNED_LABEL : labelOf(key)
  const title = label ? (projectName ? `${projectName} · ${label}` : label) : "Deliverable"

  if (!key) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} backHref={back} backLabel="Back to deliverables" />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={PackageCheck}
              compact
              className="py-10"
              title="That link is not a deliverable"
              description="Go back to the board and open one from there."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <DeliverablesTab
      projectId={projectId}
      canManage={canManage}
      currentUserId={currentUserId}
      periodKey={key}
      // The header is the page to draw; its actions are the board to supply,
      // since Add lines and Delete need the dialogs the board owns. Handing
      // the slot over puts them beside the title instead of inside the table.
      renderHeader={(actions) => (
        <PageHeader
          title={title}
          description="What each team owes for this period, who is making it, and the link or file that shows it landed."
          backHref={back}
          backLabel="Back to deliverables"
          actions={actions}
        />
      )}
    />
  )
}
