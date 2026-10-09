"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  PackageCheck,
  Plus,
  Check,
  ChevronDown,
  Pencil,
  ShieldCheck,
  Trash2,
  Link2,
  FileText,
  ExternalLink,
  CalendarDays,
  Eye,
  UserPlus,
  Lock,
  History,
  Download,
  Target,
} from "lucide-react"

import { cn, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { Pagination } from "@/components/shared/pagination"
import { TabsBar } from "@/components/shared/tabs-bar"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Link } from "@/components/tenant-link"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateField, toDateString } from "@/components/shared/date-field"
import { DateRangeField, type DateRangeValue } from "@/components/shared/date-range-field"
import { useProjectTeams } from "../hooks/use-projects"
import {
  DELIVERABLE_STATUS_LABELS,
  STATUS_ORDER,
  allowedTransition,
  deliverablesExportUrl,
  hasProof,
  nextActions,
  useDeliverableMutations,
  useProjectDeliverables,
  type DeliverableActor,
  type DeliverableFilters,
  type DeliverableRow,
  type DeliverableStatus,
} from "../hooks/use-deliverables"
import { isOpenStatus, periodClosesOn } from "../lib/deliverable-lifecycle"
import { formatPeriod } from "../lib/delivery-period"
import {
  UNPLANNED_KEY,
  groupIntoPeriods,
  periodSlug,
  splitByTeam,
  type DeliverablePeriod,
} from "../lib/deliverable-periods"
import { linkLabel } from "../lib/task-links"
import { DeliverableTracker } from "./deliverable-tracker"
import { LogWorkDialog } from "./log-work-dialog"
import { EditItemDialog } from "./edit-item-dialog"
import { PlanPeriodDialog } from "./plan-period-dialog"
import {
  DELIVERABLE_STATUS_DOT,
  DeliverableHistoryDialog,
  DeliverableStatusPill,
} from "./deliverable-history-dialog"
import { formatHours } from "../lib/format-hours"

// Row buttons come from nextActions(status, actor) - the table the server uses - so none offers a refused move.

/** Deliverables per page in the card view (the table pages itself); the items inside one are never paged. */
const PERIODS_PER_PAGE = 20

/** Mirrors OPEN_STATUSES - STUCK is owed too. */
const OPEN_FILTER: DeliverableStatus[] = ["PLANNED", "IN_PROGRESS", "STUCK"]

const todayKey = (): string => toDateString(new Date())

/** The button label, not the destination: "Log delivery", or "Redeliver" from REJECTED. */
function actionLabel(from: DeliverableStatus, to: DeliverableStatus): string {
  if (to === "IN_PROGRESS") return "Start"
  if (to === "ACCEPTED") return "Accept"
  if (to === "REJECTED") return "Request revision"
  if (to === "DELIVERED") {
    if (from === "REJECTED") return "Redeliver"
    if (from === "ACCEPTED") return "Un-accept"
    return "Mark delivered"
  }
  return DELIVERABLE_STATUS_LABELS[to]
}

interface PendingMove {
  row: DeliverableRow
  to: DeliverableStatus
  needsReason: boolean
  needsDate: boolean
}

/** Fields come from the lifecycle table's `needs`, so a server-side rule change follows automatically. */
function StatusMoveDialog({
  move,
  pending,
  onCancel,
  onConfirm,
}: {
  move: PendingMove
  pending: boolean
  onCancel: () => void
  onConfirm: (payload: { reason?: string; completedOn?: string }) => void
}) {
  // Mounted fresh per move by the caller, so the fields seed from props.
  const [reason, setReason] = React.useState("")
  const [date, setDate] = React.useState(move.row.completedOn ?? todayKey())

  const label = actionLabel(move.row.status, move.to)
  const ok = (!move.needsReason || reason.trim().length >= 3) && (!move.needsDate || Boolean(date))

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {label} &ldquo;{move.row.title}&rdquo;
          </DialogTitle>
          <DialogDescription>
            {move.to === "REJECTED"
              ? "What needs changing? The reason is recorded on the entry and shown to whoever redelivers it."
              : move.to === "DELIVERED" && move.row.status === "ACCEPTED"
                ? "Un-accepting clears the acceptance. Say why - it stays in the entry's history."
                : "The day it actually landed, which is what the client's month is counted on."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {move.needsDate && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Completed</Label>
              <DateField value={date} onChange={setDate} placeholder="Completed on" modal />
            </div>
          )}
          {move.needsReason && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-[11px]">Reason</Label>
              <Textarea
                autoFocus
                rows={3}
                value={reason}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Client wants the intro re-cut to 15s"
                aria-label="Reason"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={!ok || pending}
            variant={move.to === "REJECTED" ? "destructive" : "default"}
            onClick={() =>
              onConfirm({
                ...(move.needsReason ? { reason: reason.trim() } : {}),
                ...(move.needsDate ? { completedOn: date } : {}),
              })
            }
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function defaultExportRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 89)
  return { from: toDateString(from), to: toDateString(to) }
}

// INTERNAL includes hours, notes and author; CLIENT-SAFE drops them. The route needs a date range,
// so on "all time" one is asked for first (an unbounded export could stall the pool).
export function DeliverablesExportMenu({
  filters,
  className,
}: {
  filters: DeliverableFilters
  className?: string
}) {
  const [asking, setAsking] = React.useState<null | { client: boolean }>(null)
  const [range, setRange] = React.useState(defaultExportRange)

  const go = (client: boolean, from: string, to: string) => {
    window.open(deliverablesExportUrl({ ...filters, from, to }, client), "_blank", "noopener")
  }
  const pick = (client: boolean) => {
    if (filters.from && filters.to) go(client, filters.from, filters.to)
    else {
      setRange(defaultExportRange())
      setAsking({ client })
    }
  }
  const badRange = range.from > range.to

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("gap-1.5", className)}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => pick(false)} className="flex-col items-start gap-0.5">
            <span>Internal</span>
            <span className="text-muted-foreground text-[11px]">
              With hours, notes and who logged it
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => pick(true)} className="flex-col items-start gap-0.5">
            <span>Client-safe</span>
            <span className="text-muted-foreground text-[11px]">
              What they got, and nothing else
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={Boolean(asking)} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Which period?</DialogTitle>
            <DialogDescription>
              An export covers a date range, up to a year at a time. The last 90 days is filled in.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                From
              </Label>
              <DateField
                value={range.from}
                onChange={(from) => setRange((r) => ({ ...r, from }))}
                modal
              />
            </div>
            <div className="space-y-1.5">
              <Label required className="text-muted-foreground text-[11px]">
                To
              </Label>
              <DateField
                value={range.to}
                onChange={(to) => setRange((r) => ({ ...r, to }))}
                modal
              />
            </div>
          </div>
          {badRange && (
            <p className="text-destructive text-[11px]">The range ends before it starts.</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsking(null)}>
              Cancel
            </Button>
            <Button
              disabled={!range.from || !range.to || badRange}
              onClick={() => {
                if (asking) go(asking.client, range.from, range.to)
                setAsking(null)
              }}
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Shared by the list row and the table row so both follow the same permission rules. */
function RowIconActions({
  r,
  onVerify,
  onHistory,
  onEdit,
  onDelete,
}: {
  r: DeliverableRow
  onVerify?: () => void
  onHistory?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  // Viewing what it produced needs no permission - the only way in for someone who can't edit.
  const target = r.links[0] ?? r.files[0]?.url ?? null
  if (!target && !onEdit && !onDelete && !onHistory && !onVerify) return null
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {target && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="View"
          title={`Open what was made (${r.links.length + r.files.length} attached)`}
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <a href={target} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      )}
      {/* First, and only on a delivered item: it's what the account manager is waiting on. */}
      {onVerify && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={r.verified ? "Undo check" : "Check this work"}
          title={
            r.verified
              ? "Checked - click to undo"
              : "Check this work, so the account manager can accept it"
          }
          onClick={onVerify}
          className={
            r.verified
              ? "text-emerald-500 hover:text-emerald-600"
              : "text-muted-foreground hover:text-foreground"
          }
        >
          <ShieldCheck className="h-3.5 w-3.5" />
        </Button>
      )}
      {onHistory && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="History"
          title="History"
          onClick={onHistory}
          className="text-muted-foreground hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit"
          title="Edit"
          onClick={onEdit}
          className="text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove"
          title="Remove"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </span>
  )
}

export function DeliverableRowView({
  r,
  showProject,
  actor = "none",
  onEdit,
  onDelete,
  onStatus,
  onHistory,
  onAssign,
  claimable,
  onLogWork,
}: {
  r: DeliverableRow
  showProject?: boolean
  actor?: DeliverableActor
  onEdit?: () => void
  onDelete?: () => void
  onStatus?: (to: DeliverableStatus) => void
  onHistory?: () => void
  /** Put a name to work the team owes. Absent = this viewer may not. */
  onAssign?: (r: DeliverableRow) => void
  /** They are on the team that owes it, so the button reads "Take this". */
  claimable?: boolean
  onLogWork?: () => void
}) {
  const blocked = shortfall(r, actor)
  const moves = (onStatus ? nextActions(r.status, actor) : []).filter(
    (to) => !(to === "DELIVERED" && blocked),
  )
  const open = isOpenStatus(r.status)
  const overdue = Boolean(open && r.dueOn && r.dueOn < todayKey())
  const closesOn = r.completedOn
    ? formatDate(periodClosesOn(new Date(`${r.completedOn}T00:00:00.000Z`)), "d MMM yyyy")
    : null

  return (
    <li className="hover:bg-muted/30 flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-2.5 text-xs transition-colors">
      <div className="min-w-56 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <DeliverableStatusPill status={r.status} />
          <span className="border-border/70 text-muted-foreground rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            {r.type}
          </span>
          <span className="font-medium">{r.title}</span>
          {r.quantity > 1 && (
            <span className="bg-primary/10 text-primary rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              ×{r.quantity}
            </span>
          )}
          {r.revisionCount > 0 && (
            <span
              className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
              title={`Sent back and redelivered ${r.revisionCount} time${r.revisionCount === 1 ? "" : "s"}`}
            >
              rev {r.revisionCount}
            </span>
          )}
          {r.verified && (
            <span className="rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
              verified
            </span>
          )}
          {r.locked && (
            <span
              className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]"
              title={
                closesOn
                  ? `Period closed on ${closesOn} - only a project manager can change this now`
                  : "Period closed"
              }
            >
              <Lock className="h-3 w-3" /> locked
            </span>
          )}
        </p>
        <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
          {showProject && <span>{r.project.name}</span>}
          {r.team && <span>{r.team.name}</span>}
          {r.completedOn ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {r.startedOn && r.startedOn !== r.completedOn
                ? `${formatDate(r.startedOn, "d MMM")} - ${formatDate(r.completedOn, "d MMM yyyy")}`
                : formatDate(r.completedOn, "d MMM yyyy")}
            </span>
          ) : r.dueOn ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "text-destructive font-medium",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {/* The window when there is one; the deadline for rows planned before periods existed. */}
              {r.periodStart && r.periodEnd
                ? formatPeriod(
                    new Date(`${r.periodStart}T00:00:00.000Z`),
                    new Date(`${r.periodEnd}T00:00:00.000Z`),
                  )
                : `due ${formatDate(r.dueOn, "d MMM yyyy")}`}
              {overdue && " · overdue"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> no date set
            </span>
          )}
          {r.goal && (
            <span className="inline-flex items-center gap-1" title="Counts towards this goal">
              <Target className="h-3 w-3" /> {r.goal.title}
            </span>
          )}
          {r.hoursPerUnit !== null && (
            <span title="Share of the task's logged hours, per unit">
              ≈ {formatHours(r.hoursPerUnit)}/unit
            </span>
          )}
          {r.acceptedByName && (
            <span>
              accepted by {r.acceptedByName}
              {r.acceptedByClient ? " (the client)" : ""}
            </span>
          )}
          {r.verifiedByName && <span>checked by {r.verifiedByName}</span>}
          {r.sentBack && (
            <span className="text-amber-500" title={r.sentBack.reason ?? undefined}>
              sent back by {r.sentBack.by ?? (r.sentBack.byClient ? "the client" : "a manager")}
            </span>
          )}
          {r.task && <span>from task: {r.task.title}</span>}
          {r.loggedByName && r.loggedByName !== r.employee?.name && (
            <span>
              {r.plannedByClient ? "asked for by" : "logged by"} {r.loggedByName}
            </span>
          )}
        </p>
        {(r.links.length > 0 || r.files.length > 0) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {r.links.map((l) => (
              <a
                key={l}
                href={l}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
              >
                <Link2 className="h-3 w-3" /> {linkLabel(l)}
              </a>
            ))}
            {r.files.map((f) => (
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                title={f.fileName}
              >
                <FileText className="h-3 w-3" />{" "}
                {f.fileName.length > 32 ? `${f.fileName.slice(0, 30)}…` : f.fileName}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            ))}
          </p>
        )}
        {r.notes && <p className="text-muted-foreground mt-1 text-[11px] italic">{r.notes}</p>}

        {moves.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {onLogWork && (
              <Button variant="outline" className="gap-1.5 px-2" onClick={onLogWork}>
                Log work
              </Button>
            )}
            {moves.map((to) => (
              <Button
                key={to}
                variant={to === "ACCEPTED" ? "default" : "outline"}
                className="gap-1.5 px-2"
                onClick={() => onStatus?.(to)}
              >
                {actionLabel(r.status, to)}
              </Button>
            ))}
            {blocked && <span className="text-muted-foreground/70">{blocked}</span>}
          </p>
        )}
      </div>

      <span className="flex w-40 shrink-0 items-center gap-1.5">
        {r.employee ? (
          <OwnerCell r={r} onAssign={onAssign} nameClassName="text-muted-foreground" />
        ) : (
          <span className="flex min-w-0 items-center gap-1.5">
            <UserPlus className="text-muted-foreground/60 h-4 w-4 shrink-0" />
            {onAssign ? (
              <button
                type="button"
                onClick={() => onAssign(r)}
                className="text-primary truncate text-left hover:underline"
                title={`Owed by ${r.team?.name ?? "the team"} - put a name to it`}
              >
                {claimable ? "Take this" : "Assign"}
              </button>
            ) : (
              <span className="text-muted-foreground/70 truncate italic">Unassigned</span>
            )}
          </span>
        )}
      </span>

      <RowIconActions r={r} {...{ onHistory, onEdit, onDelete }} />
    </li>
  )
}

interface RowHandlers {
  actor: DeliverableActor
  /** Stage one: the maker's manager verifies before the account manager accepts; nobody checks their own work. */
  onVerify?: () => void
  onStatus: (to: DeliverableStatus) => void
  onHistory: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAssign?: (r: DeliverableRow) => void
  claimable: boolean
  onLogWork?: () => void
}

type Period = DeliverablePeriod<DeliverableRow>

/** Radix needs a non-empty value, and "nobody" is a real choice here. */
const NOBODY = "__nobody__"

/** The maker, editable in place; read-only when this person may not move the work. */
function OwnerCell({
  r,
  onAssign,
  className,
  nameClassName,
}: {
  r: DeliverableRow
  onAssign?: (r: DeliverableRow) => void
  className?: string
  nameClassName?: string
}) {
  if (!r.employee) return null
  const face = (
    <>
      <AvatarDisplay
        src={r.employee.profilePhoto}
        firstName={r.employee.name.split(" ")[0] ?? ""}
        lastName={r.employee.name.split(" ").slice(1).join(" ")}
        size="xs"
      />
      <span className={cn("truncate", nameClassName)}>{r.employee.name}</span>
    </>
  )
  if (!onAssign) {
    return <span className={cn("flex items-center gap-1.5", className)}>{face}</span>
  }
  return (
    <button
      type="button"
      onClick={() => onAssign(r)}
      title="Move it to someone else"
      className={cn(
        "hover:text-primary flex items-center gap-1.5 rounded-sm text-left transition-colors",
        className,
      )}
    >
      {face}
    </button>
  )
}

/** Assign or reassign an item; handing it back to the team undoes a mis-assignment. */
function AssignDialog({
  row,
  people,
  pending,
  canUnassign,
  onAssign,
  onClose,
}: {
  row: DeliverableRow
  people: { id: string; name: string }[]
  pending: boolean
  /** Only an open item can go back to nobody - something made keeps its maker. */
  canUnassign: boolean
  onAssign: (employeeId: string | null) => void
  onClose: () => void
}) {
  const current = row.employee?.id ?? NOBODY
  const [who, setWho] = React.useState(current)
  const team = row.team?.name ?? "the team"
  const reassigning = Boolean(row.employee)
  const changed = who !== current
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{reassigning ? "Move it to someone else" : "Who will make it?"}</DialogTitle>
          <DialogDescription>
            {row.type} · {row.title}
            {row.quantity > 1 ? ` ×${row.quantity}` : ""}
            {reassigning ? ` - currently ${row.employee?.name}` : ` - owed by ${team}`}. It stays
            with {team} whoever makes it.
          </DialogDescription>
        </DialogHeader>
        {people.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nobody is on {team} yet. Add members on the Teams tab first.
          </p>
        ) : (
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Pick a member" />
            </SelectTrigger>
            <SelectContent>
              {canUnassign && (
                <SelectItem value={NOBODY}>
                  <span className="text-muted-foreground">Nobody - back to {team}</span>
                </SelectItem>
              )}
              {people.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                  {e.id === row.employee?.id && (
                    <span className="text-muted-foreground ml-1.5 text-[11px]">current</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!changed || pending}
            onClick={() => onAssign(who === NOBODY ? null : who)}
          >
            {pending ? "Saving…" : reassigning ? "Move it" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PeriodHeadline({ p }: { p: Period }) {
  return (
    // No wrapping, or auto-layout squeezes this column down to one icon's width.
    <span className="flex items-center gap-2 whitespace-nowrap">
      <CalendarDays className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{p.label}</span>
      {p.overdue && <span className="text-destructive text-xs font-medium">overdue</span>}
    </span>
  )
}

function PeriodProgress({ p }: { p: Period }) {
  const pct = p.planned > 0 ? Math.round((p.made / p.planned) * 100) : 0
  return (
    <span className="inline-flex items-center gap-2">
      <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <span
          className={cn("block h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="tabular-nums">
        {p.made}
        <span className="text-muted-foreground">/{p.planned}</span>
      </span>
    </span>
  )
}

/** Why Delivered isn't allowed yet (re-checked server-side). Project managers may close out short. */
function shortfall(r: DeliverableRow, actor: DeliverableActor): string | null {
  // Proof first, for everyone including the account manager (the server refuses this too).
  if (!hasProof(r)) {
    return "The log is missing - add a link, a file or a note first."
  }
  if (actor === "project_manager") return null
  if (r.deliveredQuantity >= r.quantity) return null
  return `Only ${r.deliveredQuantity} of ${r.quantity} are logged - log the rest first.`
}

/** Stage one (the maker's manager) and stage two (the account manager) are separate sign-offs. */
function SignOff({ r }: { r: DeliverableRow }) {
  const bits: { text: string; title?: string; tone: string }[] = []

  if (r.status === "REJECTED" && r.sentBack) {
    bits.push({
      text: `sent back by ${r.sentBack.by ?? (r.sentBack.byClient ? "the client" : "a manager")}`,
      title: r.sentBack.reason ?? undefined,
      tone: "text-amber-500",
    })
  } else if (r.status === "ACCEPTED") {
    // A client acceptance is the client's own word - say which happened.
    bits.push({
      text: r.acceptedByClient
        ? `finalised by ${r.acceptedByName ?? "the client"}`
        : `accepted by ${r.acceptedByName ?? "the account manager"}`,
      title: r.verifiedByName ? `Checked first by ${r.verifiedByName}` : undefined,
      tone: "text-emerald-500",
    })
  } else if (r.status === "DELIVERED") {
    bits.push(
      r.verified
        ? {
            text: `checked by ${r.verifiedByName ?? "their manager"}`,
            title: "Waiting on the account manager to accept it",
            tone: "text-emerald-500",
          }
        : {
            text: "awaiting check",
            title: "Their manager checks it first, then the account manager accepts it",
            tone: "text-muted-foreground",
          },
    )
  }

  // A past bounce stays visible after the item moves on.
  if (r.sentBack && r.status !== "REJECTED" && r.revisionCount > 0) {
    bits.push({
      text: `rev ${r.revisionCount}`,
      title: `Last sent back by ${
        r.sentBack.by ?? (r.sentBack.byClient ? "the client" : "a manager")
      }${r.sentBack.reason ? `: ${r.sentBack.reason}` : ""}`,
      tone: "text-muted-foreground",
    })
  }

  if (bits.length === 0) return null
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]">
      {bits.map((b) => (
        <span key={b.text} className={b.tone} title={b.title}>
          {b.text}
        </span>
      ))}
    </span>
  )
}

function StatusMenu({
  r,
  actor,
  onStatus,
}: {
  r: DeliverableRow
  actor: DeliverableActor
  onStatus: (to: DeliverableStatus) => void
}) {
  // Nothing this person may do: a plain pill, not a menu that only refuses.
  if (nextActions(r.status, actor).length === 0) {
    return <DeliverableStatusPill status={r.status} />
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Change status"
          className="hover:bg-muted/60 -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors"
        >
          <DeliverableStatusPill status={r.status} />
          <ChevronDown className="text-muted-foreground h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-[11px] font-medium">
          Status
        </DropdownMenuLabel>
        {STATUS_ORDER.map((to) => {
          const current = to === r.status
          const check = allowedTransition(r.status, to, actor)
          const short = check.ok && to === "DELIVERED" ? shortfall(r, actor) : null
          const blocked = !check.ok || Boolean(short)
          const needsMore = check.ok && !short && check.needs.length > 0
          return (
            <DropdownMenuItem
              key={to}
              // A blocked move stays clickable on purpose, so pressing it explains why.
              disabled={current}
              title={current ? undefined : (short ?? (!check.ok ? check.why : undefined))}
              onSelect={(e) => {
                if (!blocked) return onStatus(to)
                e.preventDefault()
                toast.error(short ?? (check.ok ? "That move is not available." : check.why))
              }}
              className={cn("gap-2", blocked && "opacity-50")}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", DELIVERABLE_STATUS_DOT[to])} />
              <span className="flex-1">
                {DELIVERABLE_STATUS_LABELS[to]}
                {needsMore ? "…" : ""}
              </span>
              {current && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PeriodItemsTable({
  rows,
  rowProps,
  hideTeam = false,
}: {
  rows: DeliverableRow[]
  rowProps: (r: DeliverableRow) => RowHandlers
  hideTeam?: boolean
}) {
  const columns: DataTableColumn<DeliverableRow>[] = [
    ...(hideTeam
      ? []
      : [
          {
            header: "Team",
            sortValue: (r: DeliverableRow) => r.team?.name,
            className: "font-medium",
            cell: (r: DeliverableRow) =>
              r.team?.name ?? <span className="text-muted-foreground">-</span>,
          },
        ]),
    {
      header: "Deliverable",
      sortValue: (r) => r.title,
      // The one flexing column: takes the slack and lets the title truncate (min-w keeps it on phones).
      className: "w-full max-w-0 min-w-48",
      headClassName: "w-full",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="border-border/70 text-muted-foreground shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
            {r.type}
          </span>
          <span className="truncate font-medium" title={r.title}>
            {r.title}
          </span>
          {r.locked && (
            <Lock className="text-muted-foreground h-3 w-3 shrink-0" aria-label="Period closed" />
          )}
        </span>
      ),
    },
    {
      header: "Done",
      align: "right",
      sortValue: (r) => r.deliveredQuantity,
      className: "tabular-nums",
      cell: (r) => (
        <>
          <span
            className={cn(
              r.deliveredQuantity >= r.quantity
                ? "text-emerald-500"
                : r.deliveredQuantity > 0
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {r.deliveredQuantity}
          </span>
          <span className="text-muted-foreground">/{r.quantity}</span>
        </>
      ),
    },
    {
      header: "Owned by",
      sortValue: (r) => r.employee?.name,
      cell: (r) => {
        const h = rowProps(r)
        return r.employee ? (
          <OwnerCell r={r} onAssign={h.onAssign} />
        ) : h.onAssign ? (
          <button
            type="button"
            onClick={() => h.onAssign?.(r)}
            className="text-primary inline-flex items-center gap-1 hover:underline"
            title={`Owed by ${r.team?.name ?? "the team"} - put a name to it`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {h.claimable ? "Take this" : "Assign"}
          </button>
        ) : (
          <span className="text-muted-foreground/70 italic">Unassigned</span>
        )
      },
    },
    {
      header: "Status",
      sortValue: (r) => STATUS_ORDER.indexOf(r.status),
      cell: (r) => {
        const h = rowProps(r)
        return (
          <span className="flex flex-col items-start">
            <StatusMenu r={r} actor={h.actor} onStatus={h.onStatus} />
            <SignOff r={r} />
          </span>
        )
      },
    },
    {
      header: "Proof",
      sortValue: (r) => r.links.length + r.files.length,
      cell: (r) => {
        const proof = r.links.length + r.files.length
        return proof > 0 ? (
          <a
            href={r.links[0] ?? r.files[0]?.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary inline-flex items-center gap-1 hover:underline"
            title={`Open what was made (${proof} attached)`}
          >
            {r.links.length > 0 ? (
              <Link2 className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {proof}
          </a>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )
      },
    },
    {
      header: "Log work",
      cell: (r) => {
        const h = rowProps(r)
        return h.onLogWork ? (
          <Button
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={h.onLogWork}
            title="Record what is finished, with the link or file"
          >
            Log work
          </Button>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )
      },
    },
    {
      header: "Actions",
      align: "right",
      cell: (r) => {
        const h = rowProps(r)
        return (
          <span className="inline-flex justify-end">
            <RowIconActions
              r={r}
              onVerify={h.onVerify}
              onHistory={h.onHistory}
              onEdit={h.onEdit}
              onDelete={h.onDelete}
            />
          </span>
        )
      },
    },
  ]

  // A deliverable's items for one team: few, so never paged, and no column picker.
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      showSerial
      pageSize={false}
      columnToggle={false}
      itemLabel="item"
      minWidth="min-w-[860px]"
    />
  )
}

function PeriodTable({
  periods,
  pageKey,
  footerNote,
  hrefFor,
  onDeletePeriod,
}: {
  periods: Period[]
  /** The filter set; a new one returns the table to page 1. */
  pageKey: string
  footerNote?: React.ReactNode
  hrefFor: (p: Period) => string
  onDeletePeriod?: (p: Period) => void
}) {
  const columns: DataTableColumn<Period>[] = [
    {
      header: "Deliverable",
      sortValue: (p) => p.start,
      cell: (p) => <PeriodHeadline p={p} />,
    },
    {
      header: "Teams",
      // The one variable-width column: takes the slack and truncates.
      className: "text-muted-foreground w-full max-w-0 min-w-40 truncate",
      headClassName: "w-full",
      cell: (p) => <span title={p.teams.join(", ")}>{p.teams.join(", ") || "-"}</span>,
    },
    {
      header: "Planned",
      align: "right",
      sortValue: (p) => p.planned,
      className: "tabular-nums",
      cell: (p) => p.planned,
    },
    {
      header: "Delivered",
      sortValue: (p) => (p.planned > 0 ? p.made / p.planned : 0),
      cell: (p) => <PeriodProgress p={p} />,
    },
    {
      header: "Actions",
      align: "right",
      cell: (p) => (
        <span className="inline-flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Open deliverable"
            title={`Open · ${p.rows.length} ${p.rows.length === 1 ? "item" : "items"}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href={hrefFor(p)}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          {onDeletePeriod && p.key !== UNPLANNED_KEY && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete deliverable"
              title="Delete this deliverable and every item under it"
              onClick={() => onDeletePeriod(p)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      tableId="project-deliverables"
      itemLabel="deliverable"
      columns={columns}
      rows={periods}
      rowKey={(p) => p.key}
      showSerial
      pageKey={pageKey}
      minWidth="min-w-[720px]"
      footerNote={footerNote}
    />
  )
}

function PeriodCards({
  periods,
  hrefFor,
  onDeletePeriod,
}: {
  periods: Period[]
  hrefFor: (p: Period) => string
  onDeletePeriod?: (p: Period) => void
}) {
  return (
    <div className="divide-border/60 divide-y">
      {periods.map((p) => {
        return (
          <section key={p.key}>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Link href={hrefFor(p)} className="min-w-0 flex-1 hover:underline">
                <PeriodHeadline p={p} />
              </Link>
              {p.teams.length > 0 && (
                <span className="text-muted-foreground text-xs">{p.teams.join(", ")}</span>
              )}
              <PeriodProgress p={p} />
              <DeliverableStatusPill status={p.status} />
              <Button
                variant="ghost"
                size="icon"
                asChild
                aria-label="Open deliverable"
                title={`Open · ${p.rows.length} ${p.rows.length === 1 ? "item" : "items"}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href={hrefFor(p)}>
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
              {onDeletePeriod && p.key !== UNPLANNED_KEY && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete deliverable"
                  title="Delete this deliverable and every item under it"
                  onClick={() => onDeletePeriod(p)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function DeliverablesTab({
  projectId,
  canManage,
  currentUserId,
  periodKey,
  renderHeader,
}: {
  projectId: string
  canManage: boolean
  currentUserId: string
  periodKey?: string
  /** On a deliverable page the board supplies the header actions; called with null while loading. */
  renderHeader?: (actions: React.ReactNode) => React.ReactNode
}) {
  // All time by default, so the board doesn't open empty.
  const [range, setRange] = React.useState<DateRangeValue>({ preset: "all", from: null, to: null })
  const [pageState, setPageState] = React.useState<{ key: string; page: number }>({
    key: "",
    page: 1,
  })
  const [view, setView] = useViewMode("project-deliverables-view", "table")
  const [editingItem, setEditingItem] = React.useState<DeliverableRow | null>(null)
  const [logging, setLogging] = React.useState<DeliverableRow | null>(null)
  const [assigning, setAssigning] = React.useState<DeliverableRow | null>(null)
  const [deletingPeriod, setDeletingPeriod] = React.useState<Period | null>(null)

  const filters: DeliverableFilters = { from: range.from, to: range.to }

  const { data, isLoading } = useProjectDeliverables(projectId, filters)
  // Owed work with NO date range: planned rows have no completion date.
  const owed = useProjectDeliverables(projectId, { status: OPEN_FILTER })

  const teams = useProjectTeams(projectId)
  const m = useDeliverableMutations(projectId)

  const [planOpen, setPlanOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<DeliverableRow | null>(null)
  const [historyFor, setHistoryFor] = React.useState<DeliverableRow | null>(null)
  const [move, setMove] = React.useState<PendingMove | null>(null)

  const rows = React.useMemo(() => data?.rows ?? [], [data])
  const owedRows = React.useMemo(() => owed.data?.rows ?? [], [owed.data])
  // The viewer's standing on a row: the same three facts the server checks, highest wins.
  const myTeamIds = React.useMemo(
    () =>
      new Set(
        (teams.data?.data ?? []).filter((t) => t.managerId === currentUserId).map((t) => t.id),
      ),
    [teams.data, currentUserId],
  )
  // Teams the viewer is ON: unowned work is claimable by the team it was asked of.
  const myMemberTeamIds = React.useMemo(
    () =>
      new Set(
        (teams.data?.data ?? [])
          .filter((t) => (t.members ?? []).some((mem) => mem.employee?.id === currentUserId))
          .map((t) => t.id),
      ),
    [teams.data, currentUserId],
  )
  // People on a team the viewer manages: a row with no team answers to any of its assignee's managers.
  const myPeopleIds = React.useMemo(
    () =>
      new Set(
        (teams.data?.data ?? [])
          .filter((t) => t.managerId === currentUserId)
          .flatMap((t) => (t.members ?? []).map((mem) => mem.employee?.id))
          .filter((id): id is string => !!id),
      ),
    [teams.data, currentUserId],
  )
  const managesOwner = React.useCallback(
    (r: DeliverableRow) =>
      r.team ? myTeamIds.has(r.team.id) : !!r.employee && myPeopleIds.has(r.employee.id),
    [myTeamIds, myPeopleIds],
  )
  const actorFor = React.useCallback(
    (r: DeliverableRow): DeliverableActor => {
      if (canManage) return "project_manager"
      if (managesOwner(r)) return "team_manager"
      if (r.employee?.id === currentUserId) return "maker"
      if (!r.employee && r.team && myMemberTeamIds.has(r.team.id)) return "maker"
      return "none"
    },
    [canManage, managesOwner, myMemberTeamIds, currentUserId],
  )

  /** After the period closes only a project manager may edit (the history records it). */
  const mayEdit = (r: DeliverableRow) => {
    const actor = actorFor(r)
    if (actor === "none") return false
    return !r.locked || actor === "project_manager"
  }
  const managesRow = (r: DeliverableRow) => canManage || managesOwner(r)

  const startMove = (r: DeliverableRow, to: DeliverableStatus) => {
    const check = allowedTransition(r.status, to, actorFor(r))
    if (!check.ok) return
    // Delivered only needs the day it landed, which StatusMoveDialog asks for.
    const needsReason = check.needs.includes("reason")
    const needsDate = check.needs.includes("completedOn")
    if (!needsReason && !needsDate) {
      m.setStatus.mutate({ id: r.id, status: to })
      return
    }
    setMove({ row: r, to, needsReason, needsDate })
  }

  /** Owed rows from the range-free query, made rows from the ranged one (minus open rows, to avoid duplicates). */
  const allRows = React.useMemo(
    () =>
      owedRows.length > 0 ? [...owedRows, ...rows.filter((r) => !isOpenStatus(r.status))] : rows,
    [rows, owedRows],
  )

  const anything = (data?.entries ?? 0) > 0 || (owed.data?.planned.entries ?? 0) > 0

  // The live row, so an upload's refetch shows the new file set.
  const loggingRow = logging ? (allRows.find((r) => r.id === logging.id) ?? logging) : null

  const today = todayKey()
  const periods = React.useMemo(() => groupIntoPeriods(allRows, today), [allRows, today])

  const focused = periodKey ? (periods.find((x) => x.key === periodKey) ?? null) : null
  /** The tracker reads the same split, so a tab count and its bar can't disagree. */
  const itemsByTeam = React.useMemo(() => splitByTeam(focused?.rows ?? []), [focused])
  /** Derived: a team remembered from another deliverable falls back to this one's first team. */
  const [teamTab, setTeamTab] = React.useState<string>()
  const activeTeam =
    teamTab && itemsByTeam.some((t) => t.key === teamTab) ? teamTab : itemsByTeam[0]?.key

  const hrefFor = React.useCallback(
    (x: Period) => `/projects/${projectId}/deliverables/${periodSlug(x.key)}`,
    [projectId],
  )

  const totalPages = Math.max(1, Math.ceil(periods.length / PERIODS_PER_PAGE))
  // Stored with the filters, so the page falls back to 1 when they change.
  const pageKey = `${range.from ?? ""}|${range.to ?? ""}`
  const page = pageState.key === pageKey ? Math.min(pageState.page, totalPages) : 1
  const setPage = (p: number) => setPageState({ key: pageKey, page: p })
  const pagedPeriods = React.useMemo(
    () => periods.slice((page - 1) * PERIODS_PER_PAGE, page * PERIODS_PER_PAGE),
    [periods, page],
  )

  const filtersOn = Boolean(range.from)
  const truncatedNote = data?.truncated
    ? `Showing the latest ${rows.length} of ${data.entries} items. Narrow the range to see the rest; the counts above cover all of them.`
    : undefined

  const membersOf = React.useCallback(
    (id: string | null | undefined) =>
      (teams.data?.data ?? [])
        .find((t) => t.id === id)
        ?.members.map((mm) => ({
          id: mm.employee.id,
          name: `${mm.employee.firstName} ${mm.employee.lastName}`.trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) ?? [],
    [teams.data],
  )

  const emptyBoard = (
    <EmptyState
      icon={PackageCheck}
      compact
      className="py-10"
      title={filtersOn && anything ? "Nothing matches these filters" : "No deliverables yet"}
      description={
        filtersOn && anything
          ? undefined
          : canManage
            ? "Plan the first one: pick a week, the teams on it, and what each owes."
            : "The account manager plans them - a week at a time, and what each team owes for it."
      }
      // Only on an EMPTY board, for planners - "no matches" is a filter problem.
      action={
        canManage && !anything
          ? { label: "Plan deliverable", onClick: () => setPlanOpen(true) }
          : undefined
      }
    />
  )

  const rowProps = (r: DeliverableRow): RowHandlers => ({
    actor: actorFor(r),
    // Stage one: delivered items only, for whoever runs the item, never its maker (enforced server-side).
    onVerify:
      r.status === "DELIVERED" && managesRow(r) && r.employee?.id !== currentUserId
        ? () => m.verify.mutate({ id: r.id, verified: !r.verified })
        : undefined,
    onStatus: (to: DeliverableStatus) => startMove(r, to),
    onHistory: () => setHistoryFor(r),
    // Edits the three planned fields; the full form is one click further.
    onEdit: mayEdit(r) ? () => setEditingItem(r) : undefined,
    onDelete: mayEdit(r) ? () => setDeleting(r) : undefined,
    // Whoever runs the item may assign or reassign; a team member can take unclaimed work directly.
    onAssign: r.employee
      ? managesRow(r)
        ? () => setAssigning(r)
        : undefined
      : actorFor(r) !== "none"
        ? () => {
            if (managesRow(r)) setAssigning(r)
            else m.update.mutate({ id: r.id, employeeId: currentUserId })
          }
        : undefined,
    claimable: !r.employee && !managesRow(r),
    // The maker's act, only while work is left (not on accepted or delivered rows).
    onLogWork:
      actorFor(r) !== "none" && r.status !== "ACCEPTED" && r.status !== "DELIVERED"
        ? () => setLogging(r)
        : undefined,
  })

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        {renderHeader?.(null)}
        <Skeleton className="h-64 rounded-sm" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!periodKey && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeField value={range} onChange={setRange} />
            <DeliverablesExportMenu filters={{ ...filters, projectId }} />
            {/* Planning is the account manager's act (server-enforced); output is logged against owed rows. */}
            {canManage && (
              <Button className="gap-1.5" onClick={() => setPlanOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Plan deliverable
              </Button>
            )}
            <ViewToggle value={view} onChange={setView} className="ml-auto" />
          </div>
        </>
      )}

      {periodKey &&
        (focused ? (
          <>
            {renderHeader?.(
              canManage && focused.key !== UNPLANNED_KEY ? (
                <>
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setPlanOpen(true)}
                    title="Plan more items inside this period"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add items
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive gap-1.5"
                    onClick={() => setDeletingPeriod(focused)}
                    title="Delete this deliverable and every item under it"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete deliverable
                  </Button>
                </>
              ) : null,
            )}
            <DeliverableTracker
              period={focused}
              activeTeam={activeTeam}
              onTeamSelect={setTeamTab}
            />

            <Tabs value={activeTeam} onValueChange={setTeamTab}>
              <TabsBar
                variant="underline"
                items={itemsByTeam.map((t) => ({
                  value: t.key,
                  label: t.name,
                  count: t.rows.length,
                }))}
              />
              {itemsByTeam.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  <PeriodItemsTable rows={t.rows} rowProps={rowProps} hideTeam />
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : owed.isLoading ? (
          <>
            {renderHeader?.(null)}
            <Skeleton className="h-40 rounded-sm" />
          </>
        ) : (
          <>
            {renderHeader?.(null)}
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={PackageCheck}
                  compact
                  className="py-10"
                  title="No such deliverable"
                  description="It may have been deleted, or the link is out of date."
                />
              </CardContent>
            </Card>
          </>
        ))}

      {!periodKey &&
        (periods.length > 0 && view === "table" ? (
          <PeriodTable
            periods={periods}
            pageKey={pageKey}
            footerNote={truncatedNote}
            hrefFor={hrefFor}
            onDeletePeriod={canManage ? setDeletingPeriod : undefined}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              {periods.length === 0 ? (
                emptyBoard
              ) : (
                <PeriodCards
                  periods={pagedPeriods}
                  hrefFor={hrefFor}
                  onDeletePeriod={canManage ? setDeletingPeriod : undefined}
                />
              )}
              <Pagination
                page={page}
                totalPages={totalPages}
                total={periods.length}
                onPageChange={setPage}
                itemLabel="deliverable"
                pageSize={PERIODS_PER_PAGE}
                className="border-t px-4 py-2"
              />
              {truncatedNote && (
                <p className="text-muted-foreground border-border/60 border-t px-4 py-2 text-[11px]">
                  {truncatedNote}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

      <EditItemDialog
        projectId={projectId}
        row={editingItem}
        onClose={() => setEditingItem(null)}
      />

      <PlanPeriodDialog
        projectId={projectId}
        open={planOpen}
        onOpenChange={setPlanOpen}
        existing={periods}
        // On a deliverable page the window is already fixed.
        period={
          periodKey && focused?.start && focused?.end
            ? { start: focused.start, end: focused.end }
            : undefined
        }
      />

      <LogWorkDialog projectId={projectId} row={loggingRow} onClose={() => setLogging(null)} />

      {assigning && (
        <AssignDialog
          row={assigning}
          people={membersOf(assigning.team?.id)}
          pending={m.update.isPending}
          // The server won't unassign made work, and needs a team to hand it back to.
          canUnassign={isOpenStatus(assigning.status) && Boolean(assigning.team)}
          onAssign={(employeeId) =>
            m.update.mutate(
              { id: assigning.id, employeeId },
              { onSuccess: () => setAssigning(null) },
            )
          }
          onClose={() => setAssigning(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingPeriod)}
        onOpenChange={(o) => !o && setDeletingPeriod(null)}
        title={`Delete "${deletingPeriod?.label ?? ""}"?`}
        description={
          deletingPeriod
            ? `Every item under it goes - ${deletingPeriod.rows.length} across ${deletingPeriod.teams.join(", ") || "no team"}. Files already attached stay on the Files tab.`
            : ""
        }
        confirmLabel="Delete deliverable"
        variant="destructive"
        onConfirm={() => {
          const target = deletingPeriod
          setDeletingPeriod(null)
          if (!target) return
          void Promise.all(target.rows.map((r) => m.remove.mutateAsync(r.id)))
        }}
      />

      <DeliverableHistoryDialog
        projectId={projectId}
        row={historyFor}
        onClose={() => setHistoryFor(null)}
      />

      {move && (
        <StatusMoveDialog
          key={`${move.row.id}:${move.to}`}
          move={move}
          pending={m.setStatus.isPending}
          onCancel={() => setMove(null)}
          onConfirm={(payload) => {
            m.setStatus.mutate({ id: move.row.id, status: move.to, ...payload })
            setMove(null)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove "${deleting?.title}"?`}
        description="The entry goes; any files attached stay on the Files tab under Deliverables."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (deleting) m.remove.mutate(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}
