"use client"

import * as React from "react"
import {
  PackageCheck,
  Plus,
  Pencil,
  Trash2,
  Link2,
  FileText,
  ExternalLink,
  CalendarDays,
  UserPlus,
  Users,
  Lock,
  ShieldCheck,
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
  nextActions,
  useDeliverableMutations,
  useProjectDeliverables,
  type DeliverableActor,
  type DeliverableFilters,
  type DeliverableRow,
  type DeliverableStatus,
} from "../hooks/use-deliverables"
import { isOpenStatus, periodClosesOn } from "../lib/deliverable-lifecycle"
import { linkLabel } from "../lib/task-links"
import { DeliverableFormDialog } from "./deliverable-form-dialog"
import { DeliverableHistoryDialog, DeliverableStatusPill } from "./deliverable-history-dialog"
import { formatHours } from "../lib/format-hours"

// ─────────────────────────────────────────────────────────────────────────────
// The project's ledger of what was made - and what is still owed.
//
// Tasks say what people are doing; this says what came out. Filters narrow it
// (dates, team, person, type, status); GROUP BY answers the question being
// asked - "per day", "per week", "per person", "per team", "per type" - each
// group carrying its own count, which is the sum of quantities, not the number
// of rows. "10 product pages" logged once counts as ten everywhere.
//
// ── OWED IS NOT A FILTER OF THE SAME LIST ────────────────────────────────────
// Planned rows have no completion date, so they fall out of every date range
// the ledger is normally read through. Reading "what do we still owe them"
// through "what did we make in March" would answer nothing, so the owed count
// and the owed list come from their own query with no dates on it at all.
//
// ── THE BUTTONS ON A ROW COME FROM THE SAME TABLE THE SERVER USES ────────────
// `nextActions(status, actor)` decides what is drawn, so a button can never
// offer a move the API then refuses. The actor is worked out here from the same
// three facts the server checks: are they the account manager, do they manage
// the row's team, is it their own work.
// ─────────────────────────────────────────────────────────────────────────────

const ALL = "__all__"
type GroupBy = "none" | "day" | "week" | "person" | "team" | "type"

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: "none", label: "No grouping" },
  { key: "day", label: "By day" },
  { key: "week", label: "By week" },
  { key: "person", label: "By person" },
  { key: "team", label: "By team" },
  { key: "type", label: "By type" },
]

/** Owed work, for the tile and the list that hangs off it. */
const OPEN_FILTER: DeliverableStatus[] = ["PLANNED", "IN_PROGRESS"]

/** Monday of the week a yyyy-MM-dd falls in, as yyyy-MM-dd (UTC). */
function weekOf(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** Today as yyyy-MM-dd, for "is this overdue" comparisons on plain strings. */
const todayKey = (): string => toDateString(new Date())

function groupKey(r: DeliverableRow, g: GroupBy): { key: string; label: string; sort: string } {
  switch (g) {
    case "day": {
      // An owed row has no day it landed on. It sorts to the top rather than
      // being dropped: "not delivered yet" is the most current thing there is.
      if (!r.completedOn) return { key: "__open", label: "Not delivered yet", sort: "9999-12-31" }
      return {
        key: r.completedOn,
        label: formatDate(r.completedOn, "EEE d MMM yyyy"),
        sort: r.completedOn,
      }
    }
    case "week": {
      if (!r.completedOn) return { key: "__open", label: "Not delivered yet", sort: "9999-12-31" }
      const wk = weekOf(r.completedOn)
      return { key: wk, label: `Week of ${formatDate(wk, "d MMM yyyy")}`, sort: wk }
    }
    case "person":
      return r.employee
        ? { key: r.employee.id, label: r.employee.name, sort: r.employee.name }
        : { key: "__unassigned", label: "Unassigned", sort: "￿" }
    case "team":
      return {
        key: r.team?.id ?? "__none",
        label: r.team?.name ?? "No team",
        sort: r.team?.name ?? "~",
      }
    case "type":
      return { key: r.type.toLowerCase(), label: r.type, sort: r.type.toLowerCase() }
    default:
      return { key: "__all", label: "", sort: "" }
  }
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: "bad" | "warn" | "good"
}) {
  return (
    <div className="bg-muted/40 rounded-sm px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">
        {value}
        {sub && (
          <span
            className={cn(
              "ml-1 text-xs font-normal",
              tone === "bad"
                ? "text-destructive"
                : tone === "warn"
                  ? "text-amber-500"
                  : tone === "good"
                    ? "text-emerald-500"
                    : "text-muted-foreground",
            )}
          >
            {sub}
          </span>
        )}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a move is CALLED on a button.
 *
 * The destination status is not the label: "Delivered" is where the row ends
 * up, "Mark delivered" is what the person is doing, and the same destination
 * reached from REJECTED is a redelivery, which is a different act with a
 * different feeling about it.
 */
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

/**
 * Collects what a move still needs before it is sent.
 *
 * Which fields appear is read off the lifecycle table's `needs`, not guessed
 * per action, so a rule that changes server-side changes this dialog with it.
 */
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
  // Mounted fresh per move by the caller (key={row.id:to}), so the fields seed
  // straight from props - no effect, and no reason left over from the last row
  // somebody sent back.
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

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

/** Ninety days back from today, as the default when no range is on. */
function defaultExportRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 89)
  return { from: toDateString(from), to: toDateString(to) }
}

/**
 * "Export CSV", in two flavours.
 *
 * INTERNAL carries hours, notes and who wrote the entry; CLIENT-SAFE drops all
 * four, because a sheet that leaves the building should say what they got, not
 * how long it took us or what we said about it internally. Two menu items
 * rather than a checkbox on a dialog: the choice is the whole decision, and
 * burying it is how the wrong file gets attached to an email.
 *
 * The route requires a real date range (a bare export means "every deliverable
 * ever" - one GET able to stall the pool), so when the view is on "all time"
 * the range is asked for first rather than the download silently failing.
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// One row
// ─────────────────────────────────────────────────────────────────────────────

/** One entry. Links and files are the point, so they are never hidden. */
export function DeliverableRowView({
  r,
  showProject,
  actor = "none",
  onEdit,
  onDelete,
  onStatus,
  onVerify,
  onHistory,
  onAssign,
  claimable,
}: {
  r: DeliverableRow
  showProject?: boolean
  /** The viewer's standing on THIS row - decides which moves are drawn. */
  actor?: DeliverableActor
  onEdit?: () => void
  onDelete?: () => void
  onStatus?: (to: DeliverableStatus) => void
  onVerify?: (verified: boolean) => void
  onHistory?: () => void
  /** Put a name to work the team owes. Absent = this viewer may not. */
  onAssign?: (r: DeliverableRow) => void
  /** They are on the team that owes it, so the button reads "Take this". */
  claimable?: boolean
}) {
  const moves = onStatus ? nextActions(r.status, actor) : []
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
              due {formatDate(r.dueOn, "d MMM yyyy")}
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
          {r.acceptedByName && <span>accepted by {r.acceptedByName}</span>}
          {r.task && <span>from task: {r.task.title}</span>}
          {r.loggedByName && r.loggedByName !== r.employee?.name && (
            <span>logged by {r.loggedByName}</span>
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

        {/* The moves, under the entry rather than in the icon strip: they are
            sentences, not tools, and the one somebody wants is usually the one
            the row's state makes obvious. */}
        {moves.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
          </p>
        )}
      </div>

      <span className="flex w-40 shrink-0 items-center gap-1.5">
        {r.employee ? (
          <>
            <AvatarDisplay
              src={r.employee.profilePhoto}
              firstName={r.employee.name.split(" ")[0] ?? ""}
              lastName={r.employee.name.split(" ").slice(1).join(" ")}
              size="xs"
            />
            <span className="text-muted-foreground truncate">{r.employee.name}</span>
          </>
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

      {(onEdit || onDelete || onVerify || onHistory) && (
        <span className="flex shrink-0 items-center gap-0.5">
          {onVerify && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={r.verified ? "Remove verification" : "Verify"}
              title={r.verified ? "Remove verification" : "Verify - you have looked at it"}
              onClick={() => onVerify(!r.verified)}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                r.verified && "text-emerald-500",
              )}
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
      )}
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export function DeliverablesTab({
  projectId,
  canManage,
  currentUserId,
}: {
  projectId: string
  canManage: boolean
  currentUserId: string
}) {
  // All time by default: a ledger that opens empty because nothing was made
  // THIS week teaches people the tab is empty.
  const [range, setRange] = React.useState<DateRangeValue>({ preset: "all", from: null, to: null })
  const [teamId, setTeamId] = React.useState(ALL)
  const [employeeId, setEmployeeId] = React.useState(ALL)
  const [type, setType] = React.useState<string | null>(null)
  const [statuses, setStatuses] = React.useState<DeliverableStatus[]>([])
  const [groupBy, setGroupBy] = React.useState<GroupBy>("week")

  const baseFilters: DeliverableFilters = {
    from: range.from,
    to: range.to,
    teamId: teamId === ALL ? undefined : teamId,
    employeeId: employeeId === ALL ? undefined : employeeId,
    type: type ?? undefined,
  }
  const filters: DeliverableFilters = {
    ...baseFilters,
    status: statuses.length > 0 ? statuses : undefined,
  }

  const { data, isLoading } = useProjectDeliverables(projectId, filters)
  // The same view WITHOUT the status chips, so clicking "Accepted" narrows the
  // list without zeroing the tile that told you to click it. When no chip is
  // on, this is the same query key and costs nothing.
  const { data: base } = useProjectDeliverables(projectId, baseFilters)
  // The unfiltered view feeds the pickers, so narrowing never strands them.
  const all = useProjectDeliverables(projectId, {})
  // Owed work, with NO date range: a planned row has no completion date and
  // would fall out of every range the ledger is normally read through.
  const owed = useProjectDeliverables(projectId, { status: OPEN_FILTER })

  const teams = useProjectTeams(projectId)
  const m = useDeliverableMutations(projectId)

  const [formOpen, setFormOpen] = React.useState(false)
  const [planning, setPlanning] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState<DeliverableRow | null>(null)
  const [historyFor, setHistoryFor] = React.useState<DeliverableRow | null>(null)
  const [move, setMove] = React.useState<PendingMove | null>(null)

  const rows = React.useMemo(() => data?.rows ?? [], [data])
  const owedRows = React.useMemo(() => owed.data?.rows ?? [], [owed.data])
  const editing =
    rows.find((r) => r.id === editingId) ??
    owedRows.find((r) => r.id === editingId) ??
    all.data?.rows.find((r) => r.id === editingId) ??
    null

  // Who this person is, on a given row. The same three facts the server checks,
  // in the same order - higher standing wins.
  const myTeamIds = React.useMemo(
    () =>
      new Set(
        (teams.data?.data ?? []).filter((t) => t.managerId === currentUserId).map((t) => t.id),
      ),
    [teams.data, currentUserId],
  )
  // Teams the viewer is ON (not just manages) - unowned work is claimable by
  // the team it was asked of, which is how a member picks up their own share.
  const myMemberTeamIds = React.useMemo(
    () =>
      new Set(
        (teams.data?.data ?? [])
          .filter((t) => (t.members ?? []).some((mem) => mem.employee?.id === currentUserId))
          .map((t) => t.id),
      ),
    [teams.data, currentUserId],
  )
  const canStaff = canManage || myTeamIds.size > 0
  const actorFor = React.useCallback(
    (r: DeliverableRow): DeliverableActor => {
      if (canManage) return "project_manager"
      if (r.team && myTeamIds.has(r.team.id)) return "team_manager"
      if (r.employee?.id === currentUserId) return "maker"
      if (!r.employee && r.team && myMemberTeamIds.has(r.team.id)) return "maker"
      return "none"
    },
    [canManage, myTeamIds, myMemberTeamIds, currentUserId],
  )

  /**
   * May they change the row itself (as opposed to moving it along)?
   *
   * Standing, and then the lock: after the period closes the numbers are being
   * reported on, and a quiet edit changes a figure somebody already sent a
   * client. A project manager may still do it, and the history says so.
   */
  const mayEdit = (r: DeliverableRow) => {
    const actor = actorFor(r)
    if (actor === "none") return false
    return !r.locked || actor === "project_manager"
  }
  const mayVerify = (r: DeliverableRow) => canManage || (r.team ? myTeamIds.has(r.team.id) : false)

  const startMove = (r: DeliverableRow, to: DeliverableStatus) => {
    const check = allowedTransition(r.status, to, actorFor(r))
    if (!check.ok) return
    const needsReason = check.needs.includes("reason")
    const needsDate = check.needs.includes("completedOn")
    if (!needsReason && !needsDate) {
      m.setStatus.mutate({ id: r.id, status: to })
      return
    }
    setMove({ row: r, to, needsReason, needsDate })
  }

  /**
   * The ledger below is what was MADE.
   *
   * Owed work has its own section above it, and when both showed everything
   * a single owed row appeared twice - once under "Still owed" and again in
   * the ledger under "Not delivered yet", where it was also counted as
   * "1 made". The owed section only renders while no status chip is on, so
   * that is exactly when the ledger hands the open rows over to it.
   */
  const ledgerRows = React.useMemo(
    () =>
      statuses.length === 0 && owedRows.length > 0
        ? rows.filter((r) => !isOpenStatus(r.status))
        : rows,
    [rows, statuses, owedRows],
  )

  const groups = React.useMemo(() => {
    const map = new Map<
      string,
      { label: string; sort: string; rows: DeliverableRow[]; count: number }
    >()
    for (const r of ledgerRows) {
      const g = groupKey(r, groupBy)
      const cur = map.get(g.key) ?? { label: g.label, sort: g.sort, rows: [], count: 0 }
      cur.rows.push(r)
      cur.count += r.quantity
      map.set(g.key, cur)
    }
    const list = [...map.values()]
    // Dates newest first; names A-Z; types by count.
    if (groupBy === "day" || groupBy === "week") list.sort((a, b) => b.sort.localeCompare(a.sort))
    else if (groupBy === "type") list.sort((a, b) => b.count - a.count)
    else list.sort((a, b) => a.sort.localeCompare(b.sort))
    return list
  }, [ledgerRows, groupBy])

  const people = React.useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of all.data?.byPerson ?? []) seen.set(p.id, p.name)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [all.data])

  const statusCount = React.useCallback(
    (s: DeliverableStatus) => base?.byStatus.find((b) => b.status === s)?.quantity ?? 0,
    [base],
  )
  const toggleStatus = (s: DeliverableStatus) =>
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const plannedQty = owed.data?.planned.quantity ?? 0
  const plannedOverdue = owed.data?.planned.overdue ?? 0
  const perUnit = base?.hours.perUnit ?? null
  const coverage = base?.hours.coverage ?? 0

  const rowProps = (r: DeliverableRow) => ({
    actor: actorFor(r),
    onStatus: (to: DeliverableStatus) => startMove(r, to),
    onVerify: mayVerify(r)
      ? (verified: boolean) => m.verify.mutate({ id: r.id, verified })
      : undefined,
    onHistory: () => setHistoryFor(r),
    onEdit: mayEdit(r)
      ? () => {
          setPlanning(false)
          setEditingId(r.id)
          setFormOpen(true)
        }
      : undefined,
    onDelete: mayEdit(r) ? () => setDeleting(r) : undefined,
    // Only unowned rows can be assigned, and only by somebody with standing on
    // them - a manager hands it out, a member of the owed team takes it.
    onAssign:
      !r.employee && actorFor(r) !== "none"
        ? () => {
            setPlanning(false)
            setEditingId(r.id)
            setFormOpen(true)
          }
        : undefined,
    claimable: !r.employee && !canStaff,
  })

  if (isLoading && !data) return <Skeleton className="h-64 rounded-sm" />

  return (
    <div className="space-y-4">
      {/* ── Header + summary ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <PackageCheck className="text-primary h-4 w-4" /> Deliverables
              </h3>
              <p className="text-muted-foreground mt-1 text-xs">
                What the team has actually produced for this client, what is still owed, and the
                links and files to prove it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeField value={range} onChange={setRange} />
              <DeliverablesExportMenu filters={{ ...filters, projectId }} />
              {canStaff && (
                <Button
                  className="gap-1.5"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null)
                    setPlanning(true)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Plan a deliverable
                </Button>
              )}
              <Button
                className="gap-1.5"
                onClick={() => {
                  setEditingId(null)
                  setPlanning(false)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Log a deliverable
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <Tile
              label="Owed"
              value={plannedQty}
              sub={plannedOverdue > 0 ? `${plannedOverdue} overdue` : undefined}
              tone="bad"
            />
            <Tile label="Delivered" value={statusCount("DELIVERED")} />
            <Tile label="Accepted" value={statusCount("ACCEPTED")} tone="good" />
            <Tile label="Awaiting revision" value={statusCount("REJECTED")} tone="warn" />
            <Tile
              label="Hours/unit"
              value={perUnit === null ? "-" : formatHours(perUnit)}
              sub={perUnit === null ? undefined : `covers ${coverage}%`}
            />
          </div>

          {/* Status chips: multi-select, so "what is owed and what came back"
              is one click each rather than a dropdown. */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((s) => {
              const on = statuses.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] transition-colors",
                    on
                      ? "border-foreground/40 bg-muted font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {DELIVERABLE_STATUS_LABELS[s]}
                  <span className="tabular-nums opacity-70">{statusCount(s)}</span>
                </button>
              )
            })}
          </div>

          {/* Type chips double as a filter - click one to see only those. */}
          {(base?.byType.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(base?.byType ?? []).map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() =>
                    setType(type?.toLowerCase() === t.type.toLowerCase() ? null : t.type)
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] transition-colors",
                    type?.toLowerCase() === t.type.toLowerCase()
                      ? "border-foreground/40 bg-muted font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.type} <span className="tabular-nums opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── What is still owed ────────────────────────────────────────────
          Its own section rather than a filter of the ledger below, because it
          answers a different question and has to survive the date range. */}
      {owedRows.length > 0 && statuses.length === 0 && (
        <Card>
          <CardContent className="p-0">
            <p className="bg-muted/40 flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium">
              <CalendarDays className="text-muted-foreground h-3 w-3" />
              Still owed
              <span className="text-muted-foreground tabular-nums">
                {plannedQty} promised · {owed.data?.planned.entries ?? owedRows.length}{" "}
                {owedRows.length === 1 ? "entry" : "entries"}
                {plannedOverdue > 0 && (
                  <span className="text-destructive"> · {plannedOverdue} overdue</span>
                )}
              </span>
            </p>
            <ul className="divide-border/60 divide-y">
              {owedRows.map((r) => (
                <DeliverableRowView key={r.id} r={r} {...rowProps(r)} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>
            {(teams.data?.data ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Everyone</SelectItem>
            {people.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectItem key={g.key} value={g.key}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(teamId !== ALL || employeeId !== ALL || type || statuses.length > 0) && (
          <Button
            variant="ghost"
            onClick={() => {
              setTeamId(ALL)
              setEmployeeId(ALL)
              setType(null)
              setStatuses([])
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── The ledger ──────────────────────────────────────────────── */}
      {ledgerRows.length === 0 ? (
        <Card>
          <CardContent className="p-10">
            <EmptyState
              icon={PackageCheck}
              compact
              title={
                data &&
                data.entries === 0 &&
                !range.from &&
                teamId === ALL &&
                employeeId === ALL &&
                statuses.length === 0 &&
                !type
                  ? "Nothing logged yet"
                  : "Nothing matches these filters"
              }
              description={
                data && data.entries === 0
                  ? "Log the first thing the team produced for this client - a page, a video, a design."
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-border/60 divide-y">
              {groups.map((g) => (
                <section key={g.label || "all"}>
                  {groupBy !== "none" && (
                    <p className="bg-muted/40 flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium">
                      {groupBy === "person" && <Users className="text-muted-foreground h-3 w-3" />}
                      <span>{g.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {g.count} made · {g.rows.length} {g.rows.length === 1 ? "entry" : "entries"}
                      </span>
                    </p>
                  )}
                  <ul className="divide-border/60 divide-y">
                    {g.rows.map((r) => (
                      <DeliverableRowView key={r.id} r={r} {...rowProps(r)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {data?.truncated && (
              <p className="text-muted-foreground border-border/60 border-t px-4 py-2 text-[11px]">
                Showing the latest {ledgerRows.length} of {data.entries} entries. Narrow the range
                to see the rest; the counts above cover all of them.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <DeliverableFormDialog
        key={editingId ?? (planning ? "plan" : "new")}
        projectId={projectId}
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) {
            setEditingId(null)
            setPlanning(false)
          }
        }}
        entry={editing}
        // A repeat closes itself: there is no single row to attach files to.
        onCreated={(id, count) => count === 1 && setEditingId(id)}
        canManage={canManage}
        canStaff={canStaff}
        currentUserId={currentUserId}
        suggestedTypes={all.data?.suggestedTypes ?? data?.suggestedTypes ?? []}
        initial={planning ? { status: "PLANNED" } : undefined}
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
