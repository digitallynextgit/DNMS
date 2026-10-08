"use client"

import * as React from "react"
import { History } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DELIVERABLE_STATUS_LABELS,
  useDeliverableEvents,
  type DeliverableEventRow,
  type DeliverableStatus,
} from "../hooks/use-deliverables"
import { fmtWhen } from "./goal-status"

// Every write appends an event server-side; this reads them. The status colours live here (the list imports this).

/** Must stay in step with DELIVERABLE_STATUS_COLORS in lib/constants.ts (the portal's copy). */
export const DELIVERABLE_STATUS_CHIP: Record<DeliverableStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-500/12 text-blue-500",
  DELIVERED: "bg-green-500/12 text-green-500",
  ACCEPTED: "bg-emerald-500/12 text-emerald-500",
  // Orange, not amber: "redo it" is a different job from STUCK's "blocked on someone".
  REJECTED: "bg-orange-500/12 text-orange-500",
  STUCK: "bg-amber-500/12 text-amber-500",
  DISCARDED: "bg-red-500/12 text-red-500 line-through",
}

export const DELIVERABLE_STATUS_DOT: Record<DeliverableStatus, string> = {
  PLANNED: "bg-muted-foreground/40",
  IN_PROGRESS: "bg-blue-500",
  DELIVERED: "bg-green-500",
  ACCEPTED: "bg-emerald-500",
  REJECTED: "bg-orange-500",
  STUCK: "bg-amber-500",
  DISCARDED: "bg-red-500",
}

/** Chart fills: the literal values of the classes above (charts can't take Tailwind); muted stays a CSS var. */
export const DELIVERABLE_STATUS_FILL: Record<DeliverableStatus, string> = {
  PLANNED: "hsl(var(--muted-foreground) / 0.35)",
  IN_PROGRESS: "#3b82f6", // blue-500
  DELIVERED: "#22c55e", // green-500
  ACCEPTED: "#10b981", // emerald-500
  REJECTED: "#f97316", // orange-500
  STUCK: "#f59e0b", // amber-500
  DISCARDED: "#ef4444", // red-500
}

export const DELIVERABLE_STATUS_TEXT: Record<DeliverableStatus, string> = {
  PLANNED: "text-muted-foreground",
  IN_PROGRESS: "text-blue-500",
  DELIVERED: "text-green-500",
  ACCEPTED: "text-emerald-500",
  REJECTED: "text-orange-500",
  STUCK: "text-amber-500",
  DISCARDED: "text-red-500",
}

export function DeliverableStatusPill({
  status,
  className,
}: {
  status: DeliverableStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        DELIVERABLE_STATUS_CHIP[status],
        className,
      )}
    >
      {DELIVERABLE_STATUS_LABELS[status]}
    </span>
  )
}

const EVENT_LABEL: Record<DeliverableEventRow["type"], string> = {
  CREATED: "Logged",
  EDITED: "Edited",
  STATUS_CHANGED: "Status changed",
  VERIFIED: "Verified",
  UNVERIFIED: "Verification removed",
  LOCKED_EDIT: "Edited after the period closed",
}

const FIELD_LABEL: Record<string, string> = {
  type: "Type",
  title: "Title",
  quantity: "Quantity",
  status: "Status",
  startedOn: "Started",
  completedOn: "Completed",
  dueOn: "Due",
  goalId: "Goal",
  employeeId: "Made by",
  teamId: "Team",
  taskId: "Task",
  links: "Links",
  notes: "Notes",
  revisionCount: "Revisions",
  acceptedAt: "Accepted",
  verified: "Verified",
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-"
  if (Array.isArray(v)) return v.length === 0 ? "-" : v.join(", ")
  if (typeof v === "boolean") return v ? "yes" : "no"
  const s = String(v)
  // Dates arrive as ISO instants; only the day matters on a ledger row.
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s
}

function EventList({ events }: { events: DeliverableEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground px-1 py-2 text-xs">No history yet.</p>
  }
  return (
    <ol className="space-y-2.5">
      {events.map((e) => {
        const changes = Object.entries(e.changes ?? {})
        return (
          <li key={e.id} className="flex gap-2.5 text-xs">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                e.type === "LOCKED_EDIT"
                  ? "bg-amber-500"
                  : e.toStatus
                    ? DELIVERABLE_STATUS_DOT[e.toStatus]
                    : "bg-muted-foreground/40",
              )}
            />
            <div className="min-w-0">
              <p>
                <span className="font-medium">{EVENT_LABEL[e.type]}</span>
                {e.fromStatus && e.toStatus && (
                  <>
                    <span className="text-muted-foreground">: </span>
                    <span className={DELIVERABLE_STATUS_TEXT[e.fromStatus]}>
                      {DELIVERABLE_STATUS_LABELS[e.fromStatus]}
                    </span>
                    <span className="text-muted-foreground"> → </span>
                    <span className={cn("font-semibold", DELIVERABLE_STATUS_TEXT[e.toStatus])}>
                      {DELIVERABLE_STATUS_LABELS[e.toStatus]}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">
                  {" · "}
                  {fmtWhen(e.createdAt)}
                  {e.actorName ? ` · ${e.actorName}${e.actorIsClient ? " (the client)" : ""}` : ""}
                </span>
              </p>
              {changes.length > 0 && (
                <ul className="text-muted-foreground mt-1 space-y-0.5">
                  {changes.map(([field, pair]) => (
                    <li key={field} className="tabular-nums">
                      <span className="text-foreground/80">{FIELD_LABEL[field] ?? field}</span>:{" "}
                      {show(pair?.[0])} <span aria-hidden>→</span>{" "}
                      <span className="text-foreground/80">{show(pair?.[1])}</span>
                    </li>
                  ))}
                </ul>
              )}
              {e.reason && (
                <p className="text-muted-foreground border-border/60 mt-1 border-l-2 pl-2 italic">
                  {e.reason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** The events query only runs while this is open. */
export function DeliverableHistoryDialog({
  projectId,
  row,
  onClose,
}: {
  projectId: string
  row: { id: string; title: string; status: DeliverableStatus } | null
  onClose: () => void
}) {
  const { data, isLoading } = useDeliverableEvents(projectId, row?.id, Boolean(row))

  return (
    <Dialog open={Boolean(row)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <History className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{row?.title}</span>
            {row && <DeliverableStatusPill status={row.status} />}
          </DialogTitle>
          <DialogDescription>
            Every change to this entry, with who made it and the reason given at the time.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {isLoading ? <Skeleton className="h-24 rounded-sm" /> : <EventList events={data ?? []} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
