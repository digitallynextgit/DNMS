"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Play,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/utils"
import { toastError } from "@/lib/error-message"
import { useMyOwedDeliverables, type DeliverableRow } from "../hooks/use-deliverables"
import { DeliverableFormDialog } from "./deliverable-form-dialog"

// ─────────────────────────────────────────────────────────────────────────────
// What you owe.
//
// The other half of My Tasks. A task is something you decided to do; an owed
// deliverable is something the account manager promised a client on your team's
// behalf - and until this panel existed it lived only on a project page a
// member had no reason to open, which is exactly why the team was tracking it
// all in a spreadsheet instead.
//
// Two kinds of row, and the difference matters:
//   YOURS      - already has your name on it.
//   UNCLAIMED  - your TEAM owes it and nobody has picked it up. "Take this"
//                is how the second half of the handoff happens without a
//                manager having to allocate every single unit by hand.
// ─────────────────────────────────────────────────────────────────────────────

const todayKey = () => new Date().toISOString().slice(0, 10)

function DueLabel({ dueOn }: { dueOn: string | null }) {
  if (!dueOn) return <span className="text-muted-foreground">No date</span>
  const overdue = dueOn < todayKey()
  return (
    <span
      className={cn("inline-flex items-center gap-1", overdue && "text-destructive font-medium")}
    >
      <CalendarClock className="h-3 w-3" />
      {overdue ? "Overdue · " : ""}
      {formatDate(dueOn, "d MMM")}
    </span>
  )
}

function OwedRow({
  r,
  busy,
  onStart,
  onLog,
}: {
  r: DeliverableRow
  busy: boolean
  onStart: () => void
  onLog: () => void
}) {
  const unclaimed = !r.employee
  return (
    <li className="hover:bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-xs transition-colors">
      <span className="border-border/70 text-muted-foreground rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
        {r.type}
      </span>
      <span className="min-w-40 flex-1 font-medium">
        {r.title}
        {r.quantity > 1 && <span className="text-muted-foreground"> × {r.quantity}</span>}
      </span>
      <span className="text-muted-foreground truncate">{r.project.name}</span>
      {unclaimed && (
        <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <UserPlus className="h-3 w-3" />
          {r.team?.name ?? "Team"} · unclaimed
        </span>
      )}
      <DueLabel dueOn={r.dueOn} />
      <span className="flex shrink-0 items-center gap-1">
        {/* Not started yet: taking it and starting it are the same intent. */}
        {r.status === "PLANNED" && !r.task && (
          <Button variant="outline" onClick={onStart} disabled={busy} className="h-7 gap-1 px-2">
            <Play className="h-3 w-3" />
            {unclaimed ? "Take it" : "Start"}
          </Button>
        )}
        <Button onClick={onLog} disabled={busy} className="h-7 gap-1 px-2">
          <PackageCheck className="h-3 w-3" /> Log it
        </Button>
      </span>
    </li>
  )
}

export function OwedDeliverablesPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useMyOwedDeliverables()
  const [open, setOpen] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [logging, setLogging] = React.useState<DeliverableRow | null>(null)

  const refresh = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["my-owed-deliverables"] })
    void qc.invalidateQueries({ queryKey: ["my-tasks"] })
    void qc.invalidateQueries({ queryKey: ["deliverables"] })
  }, [qc])

  async function start(r: DeliverableRow) {
    setBusyId(r.id)
    try {
      const res = await apiFetch<{ data: { taskId: string; claimed: boolean } }>(
        `/api/projects/${r.projectId}/deliverables/${r.id}/start`,
        { method: "POST" },
      )
      toast.success(
        res.data.claimed
          ? `"${r.title}" is yours - it is on your task list now.`
          : `Started "${r.title}" - it is on your task list now.`,
      )
      refresh()
    } catch (e) {
      toastError(e, "Could not start that")
    } finally {
      setBusyId(null)
    }
  }

  const rows = data?.rows ?? []
  if (isLoading) return <Skeleton className="h-24 rounded-sm" />
  // Nothing owed is the good case, and it should take up no room at all.
  if (rows.length === 0) return null

  return (
    <section className="bg-card rounded-sm border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted/40 flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors"
      >
        {open ? (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        )}
        <h2 className="text-sm font-semibold">What you owe</h2>
        <span className="text-muted-foreground text-xs tabular-nums">{rows.length}</span>
        {data && data.overdue > 0 && (
          <span className="bg-destructive/10 text-destructive rounded-sm px-1.5 py-0.5 text-[10px] font-semibold">
            {data.overdue} overdue
          </span>
        )}
        {data && data.unclaimed > 0 && (
          <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            {data.unclaimed} unclaimed
          </span>
        )}
      </button>

      {open && (
        <ul className="divide-border/70 divide-y border-t">
          {rows.map((r) => (
            <OwedRow
              key={r.id}
              r={r}
              busy={busyId === r.id}
              onStart={() => void start(r)}
              onLog={() => setLogging(r)}
            />
          ))}
        </ul>
      )}

      {/* The full form, so the evidence (links and files) lands with the row -
          which is the entire reason the ledger exists. */}
      {logging && (
        <DeliverableFormDialog
          key={logging.id}
          projectId={logging.projectId}
          open
          onOpenChange={(o) => {
            if (!o) {
              setLogging(null)
              refresh()
            }
          }}
          entry={logging}
          onCreated={() => refresh()}
          canManage={false}
          currentUserId={currentUserId}
          suggestedTypes={[]}
          submitStatus="DELIVERED"
          submitLabel="Mark delivered"
          prompt="What did you produce? Add the link or the file so the client can be shown it."
        />
      )}
    </section>
  )
}
