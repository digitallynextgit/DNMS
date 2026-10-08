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

/** One period on its own page: the board narrowed to one key, so permissions and dialogs stay shared. */
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

  // Read from the URL, so the title is right before any data arrives.
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
      // The board supplies the header actions, since Add lines and Delete need its dialogs.
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
