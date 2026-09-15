"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DoorOpen, ShieldAlert, ShieldCheck } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatStrip } from "@/components/shared/stat-strip"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useTenantPath } from "@/components/tenant-link"
import { PERMISSIONS } from "@/lib/constants"
import { cn, formatDate } from "@/lib/utils"
import {
  ChecklistProgressBar,
  useServingNotice,
  type ServingNoticeRow,
} from "@/features/hr-checklists"

/**
 * Who is serving notice.
 *
 * This is the answer to "who is leaving, when, and what is holding it up". It
 * is built from ACCEPTED resignations against still-active accounts rather than
 * from an employee status, because "serving notice" is a fact about two dates
 * and not a state anybody sets.
 */
export default function ExitClearancePage() {
  const router = useRouter()
  const tp = useTenantPath()
  const { can } = usePermissions()
  const canRead = can(PERMISSIONS.EXIT_READ) || can(PERMISSIONS.EXIT_WRITE)

  const { data: rows, isLoading } = useServingNotice()

  const stats = React.useMemo(() => {
    const list = rows ?? []
    const blocked = list.filter((r) => (r.checklist?.blocking.length ?? 0) > 0).length
    const leavingThisWeek = list.filter((r) => daysLeft(r.lastWorkingDate) <= 7).length
    return [
      { label: "Serving notice", value: list.length },
      { label: "Last day within 7 days", value: leavingThisWeek, tone: "warning" as const },
      { label: "Blocked on clearances", value: blocked, tone: "danger" as const },
    ]
  }, [rows])

  if (!canRead) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        You do not have permission to view exit clearances.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 rounded-sm" />
        <Skeleton className="h-20 rounded-sm" />
        <Skeleton className="h-48 rounded-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exit clearance"
        description="Everyone serving notice, their last working day, and the sign-offs still blocking relieving."
      />

      {(rows?.length ?? 0) > 0 && <StatStrip items={stats} />}

      {(rows?.length ?? 0) === 0 ? (
        <EmptyState
          icon={DoorOpen}
          variant="card"
          title="Nobody is serving notice"
          description="An exit clearance starts automatically when a resignation is accepted."
        />
      ) : (
        <div className="space-y-3">
          {rows?.map((row) => (
            <LeaverCard
              key={row.resignationId}
              row={row}
              onOpen={(id) => router.push(tp(`/exit-clearance/${id}`))}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Whole days from today to the last working day. Negative once it has passed. */
function daysLeft(lastWorkingDate: string | null): number {
  if (!lastWorkingDate) return Number.POSITIVE_INFINITY
  const last = new Date(lastWorkingDate)
  if (Number.isNaN(last.getTime())) return Number.POSITIVE_INFINITY
  const now = new Date()
  const lastUtc = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((lastUtc - nowUtc) / 86_400_000)
}

function noticeLabel(days: number): { text: string; urgent: boolean } {
  if (!Number.isFinite(days)) return { text: "No last working day set", urgent: true }
  if (days < 0) return { text: `Last day passed ${Math.abs(days)}d ago`, urgent: true }
  if (days === 0) return { text: "Last working day is today", urgent: true }
  if (days === 1) return { text: "1 day left", urgent: true }
  return { text: `${days} days left`, urgent: days <= 7 }
}

function LeaverCard({ row, onOpen }: { row: ServingNoticeRow; onOpen: (id: string) => void }) {
  const e = row.employee
  const days = daysLeft(row.lastWorkingDate)
  const notice = noticeLabel(days)
  const blocking = row.checklist?.blocking ?? []

  return (
    <article className="bg-card rounded-sm border p-4">
      <div className="flex flex-wrap items-start gap-3">
        <AvatarDisplay
          firstName={e.firstName}
          lastName={e.lastName}
          src={e.profilePhoto}
          size="lg"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-sm font-medium">
              {e.firstName} {e.lastName}
            </h3>
            <span className="text-muted-foreground text-xs">
              {e.designation?.title ?? e.employeeNo}
              {e.department?.name && ` · ${e.department.name}`}
            </span>
          </div>

          <p className="text-muted-foreground text-xs">
            Resigned {formatDate(row.resignedOn)} · last working day{" "}
            <strong className="text-foreground">{formatDate(row.lastWorkingDate)}</strong>
            {e.manager && ` · reports to ${e.manager.firstName} ${e.manager.lastName}`}
          </p>

          <p
            className={cn(
              "text-xs font-medium",
              notice.urgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            {notice.text}
          </p>
        </div>

        {row.checklist && (
          <div className="w-full sm:w-56">
            <ChecklistProgressBar
              progress={{
                total: row.checklist.total,
                done: row.checklist.done,
                percent:
                  row.checklist.total === 0
                    ? 0
                    : row.checklist.done === row.checklist.total
                      ? 100
                      : Math.floor((row.checklist.done / row.checklist.total) * 100),
                clearancesTotal: row.checklist.clearancesTotal,
                clearancesDone: row.checklist.clearancesDone,
              }}
            />
          </div>
        )}

        <Button
          variant="outline"
          className="shrink-0"
          onClick={() => row.checklist && onOpen(row.checklist.id)}
          disabled={!row.checklist}
        >
          {row.checklist ? "Open" : "No checklist"}
        </Button>
      </div>

      {/* The number HR actually needs: what is stopping relieving today. */}
      {row.checklist &&
        (blocking.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm bg-amber-500/10 px-3 py-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="text-xs">
              Relieving blocked by {blocking.length} clearance{blocking.length === 1 ? "" : "s"}:{" "}
              <strong>{blocking.map((b) => b.text).join(", ")}</strong>
            </span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 rounded-sm bg-green-500/10 px-3 py-2">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
            <span className="text-xs">All clearances signed - ready for HR sign-off.</span>
          </div>
        ))}
    </article>
  )
}
