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

// ─────────────────────────────────────────────────────────────────────────────
// The deliverables board: what the client is owed, period by period.
//
// The account manager plans a DELIVERABLE - always a working week - and says
// what each team owes inside it ("4 blogs from WEB, 2 reels from VIDEO"). That
// period is one row on the board; the per-team items are what it is made of.
// The team's manager puts a name on each item, the person named logs the link
// or file when it lands, and the account manager accepts it or sends it back.
// Counts are sums of quantities, not rows: "10 product pages" logged once
// counts as ten everywhere.
//
// ── OWED IS NOT A FILTER OF THE SAME LIST ────────────────────────────────────
// Planned rows have no completion date, so they fall out of every date range
// the board is normally read through. Reading "what do we still owe them"
// through "what did we make in March" would answer nothing, so the owed count
// and the owed list come from their own query with no dates on it at all.
//
// ── THE BUTTONS ON A ROW COME FROM THE SAME TABLE THE SERVER USES ────────────
// `nextActions(status, actor)` decides what is drawn, so a button can never
// offer a move the API then refuses. The actor is worked out here from the same
// three facts the server checks: are they the account manager, do they manage
// the row's team, is it their own work.
// ─────────────────────────────────────────────────────────────────────────────

/** Deliverables per page. The items INSIDE one are never paged: opening a
 *  deliverable shows all of it. */
const PERIODS_PER_PAGE = 20

/** Owed work, for the tile and the list that hangs off it. */
const OPEN_FILTER: DeliverableStatus[] = ["PLANNED", "IN_PROGRESS"]

/** Today as yyyy-MM-dd, for "is this overdue" comparisons on plain strings. */
const todayKey = (): string => toDateString(new Date())

// ─────────────────────────────────────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What a move is CALLED on a button.
 *
 * The destination status is not the label: "Delivered" is where the row ends
 * up, "Log delivery" is what the person is doing, and the same destination
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
/**
 * The per-row tools: view, history, edit, remove.
 *
 * Its own component because the list row and the TABLE row both draw exactly
 * these four, and a second copy is a second thing to keep in step with the
 * permission rules that decide which of them exist.
 */
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
  // The thing itself: the first link, or the first file. This is the one action
  // that needs no permission - anyone who can see the row can look at what it
  // produced - and it is the only way in for somebody who cannot edit.
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
      {/* First, and only on a delivered item: it is the one thing a manager
          opens this row to do, and it blocks the account manager behind it. */}
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
  /** The viewer's standing on THIS row - decides which moves are drawn. */
  actor?: DeliverableActor
  onEdit?: () => void
  onDelete?: () => void
  onStatus?: (to: DeliverableStatus) => void
  onHistory?: () => void
  /** Put a name to work the team owes. Absent = this viewer may not. */
  onAssign?: (r: DeliverableRow) => void
  /** They are on the team that owes it, so the button reads "Take this". */
  claimable?: boolean
  /** Record progress - the same act as the table row s Log work. */
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
              {/* The WINDOW when there is one - "3 reels a week" was agreed
                  across a week, and "due 4 Oct" only ever said when that week
                  ran out. Falls back to the deadline for rows planned before
                  periods existed. */}
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
          {r.acceptedByName && <span>accepted by {r.acceptedByName}</span>}
          {r.verifiedByName && <span>checked by {r.verifiedByName}</span>}
          {r.sentBack && (
            <span className="text-amber-500" title={r.sentBack.reason ?? undefined}>
              sent back by {r.sentBack.by ?? "a manager"}
            </span>
          )}
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

// ─────────────────────────────────────────────────────────────────────────────

/**
 * The same rows as a table.
 *
 * Not a different list - the SAME rows, the same permissions, the same
 * `rowProps`. The card view is for reading one entry (its links, its files, its
 * notes); the table is for scanning fifty and comparing a column. Owed and
 * delivered sit in one table here because the Status column already tells them
 * apart, which is the job the two bands do in the card view.
 */
// ─────────────────────────────────────────────────────────────────────────────
// The board: deliverables (periods), and the items inside them
// ─────────────────────────────────────────────────────────────────────────────

/** What an item's row is handed - the same handlers the card row takes, by name. */
interface RowHandlers {
  actor: DeliverableActor
  /**
   * Stage one: the maker's manager says the work is real, before the account
   * manager accepts it. Absent when this viewer is not the one to do that -
   * including when they made it, because nobody checks their own work.
   */
  onVerify?: () => void
  onStatus: (to: DeliverableStatus) => void
  onHistory: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAssign?: (r: DeliverableRow) => void
  claimable: boolean
  /** Open the log-work dialog, when this person may add to it. */
  onLogWork?: () => void
}

type Period = DeliverablePeriod<DeliverableRow>

/**
 * Put a name on an owed item.
 *
 * A dialog rather than a select in the cell: the choice is one of the owed
 * team's members only, and the sentence saying the team stays put needs room a
 * table cell does not have.
 */
/** Radix needs a non-empty value, and "nobody" is a real choice here. */
const NOBODY = "__nobody__"

/**
 * The maker, and the way to change them.
 *
 * One control rather than a separate edit affordance: the name IS the thing
 * being changed, and a pencil beside it would be more furniture than a single
 * field earns. Read-only when this person may not move the work.
 */
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

/**
 * Put a name on an item, or move it to a different one.
 *
 * The same dialog for both: they differ only in whether a name is already
 * there, and a wrong name needs fixing far more often than it needs a screen
 * of its own. Handing it back to the team is on the list too, because that is
 * how people undo a mis-assignment.
 */
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
              {/* Clearing it is how a mis-assignment gets undone, so it is on
                  the list rather than behind a second control. */}
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

/** A period's name line, said the same way in both views. */
function PeriodHeadline({ p }: { p: Period }) {
  return (
    // No wrapping. Beyond looking broken, a wrappable cell tells the table its
    // minimum width is one icon - so auto-layout squeezed this column and gave
    // the room to Teams, which is how a short date ended up on two lines.
    <span className="flex items-center gap-2 whitespace-nowrap">
      <CalendarDays className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="font-semibold">{p.label}</span>
      {p.overdue && <span className="text-destructive text-xs font-medium">overdue</span>}
    </span>
  )
}

/** Made over planned, as a bar the eye reads before the number. */
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

/**
 * The status cell, as a menu of where this item can go next.
 *
 * All five states are listed, not just the reachable ones: seeing that
 * Accepted is greyed out until something has been delivered is how the flow
 * explains itself. A greyed row carries the reason as its tooltip - the same
 * sentence the server would answer with, which is what allowedTransition
 * writes it for.
 *
 * A trailing ellipsis marks the moves that open a dialog first, because they
 * need something the row cannot supply on its own: the link or file and the
 * day for a delivery, a reason for sending work back.
 */
/**
 * Why Delivered is not on the table yet.
 *
 * The promise is four blogs; one is written. `allowedTransition` cannot see
 * that - it knows statuses and standing, not quantities - so the shortfall is
 * checked here and again on the server, which is the copy that counts.
 *
 * A project manager is exempt: closing a period out on three of four is a
 * real decision somebody has to be able to make.
 */
function shortfall(r: DeliverableRow, actor: DeliverableActor): string | null {
  // Proof first, and for EVERYONE including the account manager: closing a
  // period out early is a judgement they are entitled to make, but declaring
  // something delivered with no record of it is a hole in the trail the
  // client is eventually shown. The server refuses this too.
  if (!hasProof(r)) {
    return "The log is missing - add a link, a file or a note first."
  }
  if (actor === "project_manager") return null
  if (r.deliveredQuantity >= r.quantity) return null
  return `Only ${r.deliveredQuantity} of ${r.quantity} are logged - log the rest first.`
}

/**
 * The two sign-offs, in the one place the status is already read.
 *
 * Stage one is the maker's own manager, stage two the account manager, and
 * a bounce is neither - so these cannot collapse into one "approved by".
 * An item can be accepted with no stage one at all (the account manager may
 * go straight to it), which is exactly why the line has to say WHICH.
 */
function SignOff({ r }: { r: DeliverableRow }) {
  const bits: { text: string; title?: string; tone: string }[] = []

  if (r.status === "REJECTED" && r.sentBack) {
    bits.push({
      text: `sent back by ${r.sentBack.by ?? "a manager"}`,
      title: r.sentBack.reason ?? undefined,
      tone: "text-amber-500",
    })
  } else if (r.status === "ACCEPTED") {
    bits.push({
      text: `accepted by ${r.acceptedByName ?? "the account manager"}`,
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

  // A past bounce stays visible after the item moves on: somebody reading an
  // accepted item is entitled to know it took two goes.
  if (r.sentBack && r.status !== "REJECTED" && r.revisionCount > 0) {
    bits.push({
      text: `rev ${r.revisionCount}`,
      title: `Last sent back by ${r.sentBack.by ?? "a manager"}${
        r.sentBack.reason ? `: ${r.sentBack.reason}` : ""
      }`,
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
  // Nothing this person may do with it - a plain pill, not a menu that only
  // ever refuses.
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
              // A blocked move stays CLICKABLE on purpose. Greying it out says
              // "not now" but never why, and the why is the whole point: the
              // person is one log entry away from being allowed. So pressing it
              // answers, rather than doing nothing.
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

/**
 * The items inside one deliverable - a table with its OWN header, because an
 * item answers different questions from the period it sits in: which team,
 * what exactly, who is making it, is the proof on yet.
 */
function PeriodItemsTable({
  rows,
  rowProps,
  hideTeam = false,
}: {
  rows: DeliverableRow[]
  rowProps: (r: DeliverableRow) => RowHandlers
  /** Inside a per-team tab the team is the heading; a column saying it again is noise. */
  hideTeam?: boolean
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead className="bg-muted/30 text-muted-foreground border-b text-[11px]">
        <tr>
          <th className="w-14 px-4 py-2 font-medium whitespace-nowrap">S.No</th>
          {!hideTeam && <th className="px-4 py-2 font-medium">Team</th>}
          <th className="w-full px-4 py-2 font-medium">Deliverable</th>
          <th className="px-4 py-2 text-right font-medium">Done</th>
          <th className="px-4 py-2 font-medium">Owned by</th>
          <th className="px-4 py-2 font-medium">Status</th>
          <th className="px-4 py-2 font-medium">Proof</th>
          <th className="px-4 py-2 font-medium whitespace-nowrap">Log work</th>
          <th className="w-px px-4 py-2 text-right font-medium whitespace-nowrap">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-border/60 divide-y">
        {rows.map((r, i) => {
          const h = rowProps(r)
          const proof = r.links.length + r.files.length
          return (
            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
              <td className="text-muted-foreground px-4 py-2.5 tabular-nums">{i + 1}</td>
              {!hideTeam && (
                <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {r.team?.name ?? <span className="text-muted-foreground">-</span>}
                </td>
              )}
              <td className="px-4 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="border-border/70 text-muted-foreground shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
                    {r.type}
                  </span>
                  <span className="truncate font-medium" title={r.title}>
                    {r.title}
                  </span>
                  {r.locked && (
                    <Lock
                      className="text-muted-foreground h-3 w-3 shrink-0"
                      aria-label="Period closed"
                    />
                  )}
                </span>
              </td>
              {/* Progress, not just the promise: four blogs with one written
                  reads 1/4 here and nowhere else on the row. */}
              <td className="px-4 py-2.5 text-right tabular-nums">
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
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {r.employee ? (
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
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-col items-start">
                  <StatusMenu r={r} actor={h.actor} onStatus={h.onStatus} />
                  <SignOff r={r} />
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {proof > 0 ? (
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
                )}
              </td>
              {/* Its own column: it is the one thing the person doing the work
                  comes here to press, and sharing a cell with five icons made it
                  jump left and right depending on how many of them applied. */}
              <td className="px-4 py-2.5 whitespace-nowrap">
                {h.onLogWork ? (
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
                )}
              </td>
              <td className="w-px px-4 py-2.5 text-right whitespace-nowrap">
                <RowIconActions
                  r={r}
                  onVerify={h.onVerify}
                  onHistory={h.onHistory}
                  onEdit={h.onEdit}
                  onDelete={h.onDelete}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/**
 * The board as a table: one row per deliverable, its items folded underneath.
 *
 * One <table>, not one per period - separate tables size their columns on
 * their own and would not line up. The open state is a second row spanning
 * the width, holding the items' table with its own header.
 */
function PeriodTable({
  periods,
  serialOffset,
  hrefFor,
  onDeletePeriod,
}: {
  periods: Period[]
  serialOffset: number
  /** Where a period opens - its own page, not a row under this one. */
  hrefFor: (p: Period) => string
  onDeletePeriod?: (p: Period) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-auto text-left text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="text-muted-foreground w-16 px-4 py-3 font-medium whitespace-nowrap">
              S.No
            </th>
            <th className="text-muted-foreground px-4 py-3 font-medium whitespace-nowrap">
              Deliverable
            </th>
            <th className="text-muted-foreground w-full px-4 py-3 font-medium">Teams</th>
            <th className="text-muted-foreground px-4 py-3 text-right font-medium whitespace-nowrap">
              Planned
            </th>
            <th className="text-muted-foreground px-4 py-3 font-medium whitespace-nowrap">
              Delivered
            </th>
            <th className="text-muted-foreground w-px px-4 py-3 text-right font-medium whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        {periods.map((p, i) => {
          return (
            <tbody key={p.key} className="border-b">
              <tr className="hover:bg-muted/30 transition-colors">
                <td className="text-muted-foreground px-4 py-3 align-middle tabular-nums">
                  {serialOffset + i + 1}
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap">
                  <PeriodHeadline p={p} />
                </td>
                {/* The one column whose width is really variable, so it takes
                    the slack and truncates rather than pushing the numbers out. */}
                <td className="text-muted-foreground max-w-0 min-w-40 truncate px-4 py-3 align-middle">
                  {p.teams.join(", ") || "-"}
                </td>
                <td className="px-4 py-3 text-right align-middle tabular-nums">{p.planned}</td>
                <td className="px-4 py-3 align-middle whitespace-nowrap">
                  <PeriodProgress p={p} />
                </td>
                <td className="w-px px-4 py-3 text-right align-middle whitespace-nowrap">
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
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeletePeriod(p)
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

/**
 * The board as cards: the same periods, each opening into the full row view -
 * links, files and notes inline - for reading one item's proof rather than
 * scanning fifty.
 */
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
  /**
   * Narrow the board to ONE deliverable - its own page. Everything else (the
   * summary, the filters, the list of periods) stays out of the way, and the
   * items are shown in full rather than folded under a row.
   */
  periodKey?: string
  /**
   * On a deliverable page, the page draws the header and the board supplies
   * what goes in its actions slot - Add items, Delete - because those need
   * the board state (the dialogs) that the page does not have. Called with
   * null while nothing is loaded yet, so the title never blinks out.
   */
  renderHeader?: (actions: React.ReactNode) => React.ReactNode
}) {
  // All time by default: a board that opens empty because nothing was made
  // THIS week teaches people the tab is empty.
  const [range, setRange] = React.useState<DateRangeValue>({ preset: "all", from: null, to: null })
  const [pageState, setPageState] = React.useState<{ key: string; page: number }>({
    key: "",
    page: 1,
  })
  // Table for scanning the periods; cards for reading one item's proof.
  const [view, setView] = useViewMode("project-deliverables-view", "table")
  /** The item whose type/title/quantity is being corrected. */
  const [editingItem, setEditingItem] = React.useState<DeliverableRow | null>(null)
  /** The item whose progress is being logged. */
  const [logging, setLogging] = React.useState<DeliverableRow | null>(null)
  /** The item getting a name put on it. */
  const [assigning, setAssigning] = React.useState<DeliverableRow | null>(null)
  /** The whole deliverable being removed - every item under it. */
  const [deletingPeriod, setDeletingPeriod] = React.useState<Period | null>(null)

  /** The only thing that narrows the board now: the range in the header. */
  const filters: DeliverableFilters = { from: range.from, to: range.to }

  const { data, isLoading } = useProjectDeliverables(projectId, filters)
  // Owed work, with NO date range: a planned row has no completion date and
  // would fall out of every range the board is normally read through.
  const owed = useProjectDeliverables(projectId, { status: OPEN_FILTER })

  const teams = useProjectTeams(projectId)
  const m = useDeliverableMutations(projectId)

  const [planOpen, setPlanOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<DeliverableRow | null>(null)
  const [historyFor, setHistoryFor] = React.useState<DeliverableRow | null>(null)
  const [move, setMove] = React.useState<PendingMove | null>(null)

  const rows = React.useMemo(() => data?.rows ?? [], [data])
  const owedRows = React.useMemo(() => owed.data?.rows ?? [], [owed.data])
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
  /** Runs the item: the account manager, or the manager of the team it was asked of. */
  const managesRow = (r: DeliverableRow) => canManage || (r.team ? myTeamIds.has(r.team.id) : false)

  const startMove = (r: DeliverableRow, to: DeliverableStatus) => {
    const check = allowedTransition(r.status, to, actorFor(r))
    if (!check.ok) return
    // Delivered is a declaration, not a place to attach things: the proof
    // went on as the work was logged, and the only thing still missing is
    // the day it landed, which StatusMoveDialog asks for.
    const needsReason = check.needs.includes("reason")
    const needsDate = check.needs.includes("completedOn")
    if (!needsReason && !needsDate) {
      m.setStatus.mutate({ id: r.id, status: to })
      return
    }
    setMove({ row: r, to, needsReason, needsDate })
  }

  /**
   * Everything on the board, once.
   *
   * Owed items come from their own range-free query (with no completion date
   * they fall inside no range); made items from the ranged one. While no
   * status chip is on, the ranged query is trimmed of open rows so an item
   * cannot appear twice.
   */
  const allRows = React.useMemo(
    () =>
      owedRows.length > 0 ? [...owedRows, ...rows.filter((r) => !isOpenStatus(r.status))] : rows,
    [rows, owedRows],
  )

  /** Is there anything on this project at all - made, or still owed? */
  const anything = (data?.entries ?? 0) > 0 || (owed.data?.planned.entries ?? 0) > 0

  // The LIVE row behind the log dialog: uploading a file refetches the list,
  // and a snapshot taken at click time would keep showing the old file set.
  const loggingRow = logging ? (allRows.find((r) => r.id === logging.id) ?? logging) : null

  const today = todayKey()
  /** The board: one deliverable per window, newest first, searched. */
  const periods = React.useMemo(() => groupIntoPeriods(allRows, today), [allRows, today])

  /** The one deliverable this page is about, when it is a page. */
  const focused = periodKey ? (periods.find((x) => x.key === periodKey) ?? null) : null
  /** The focused period, per team - the tracker above the tabs reads the same
   *  split, so a tab count and the bar beside it cannot disagree. */
  const itemsByTeam = React.useMemo(() => splitByTeam(focused?.rows ?? []), [focused])
  /**
   * Which team tab is open.
   *
   * Derived, not synced: a team remembered from another deliverable simply is
   * not in this one, and falls back to its first team with no effect to run.
   */
  const [teamTab, setTeamTab] = React.useState<string>()
  const activeTeam =
    teamTab && itemsByTeam.some((t) => t.key === teamTab) ? teamTab : itemsByTeam[0]?.key

  /** Where a period opens. The project ref in the URL is whatever the board got. */
  const hrefFor = React.useCallback(
    (x: Period) => `/projects/${projectId}/deliverables/${periodSlug(x.key)}`,
    [projectId],
  )

  const totalPages = Math.max(1, Math.ceil(periods.length / PERIODS_PER_PAGE))
  // Derived, not synced: a page number only means anything for the list it
  // was chosen over, so it is stored WITH the filters and falls back to 1.
  const pageKey = range.from ?? ""
  const page = pageState.key === pageKey ? Math.min(pageState.page, totalPages) : 1
  const setPage = (p: number) => setPageState({ key: pageKey, page: p })
  const pagedPeriods = React.useMemo(
    () => periods.slice((page - 1) * PERIODS_PER_PAGE, page * PERIODS_PER_PAGE),
    [periods, page],
  )

  /** The range in the header is the only thing left that can narrow the board. */
  const filtersOn = Boolean(range.from)

  /** Members of the team an item was asked of - who it can be handed to. */
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
      // The way out of an empty board, for the person allowed to plan, and only
      // when it is EMPTY: "no matches" is a filter problem, and offering to
      // create something is the wrong answer to it.
      action={
        canManage && !anything
          ? { label: "Plan deliverable", onClick: () => setPlanOpen(true) }
          : undefined
      }
    />
  )

  const rowProps = (r: DeliverableRow): RowHandlers => ({
    actor: actorFor(r),
    // Stage one of two. Offered only on a DELIVERED item (there is nothing to
    // check before and nothing to add after), only to whoever runs the item,
    // and never to the person who made it - the server enforces all three, and
    // the line-manager fallback it also allows simply is not drawn here.
    onVerify:
      r.status === "DELIVERED" && managesRow(r) && r.employee?.id !== currentUserId
        ? () => m.verify.mutate({ id: r.id, verified: !r.verified })
        : undefined,
    onStatus: (to: DeliverableStatus) => startMove(r, to),
    onHistory: () => setHistoryFor(r),
    // The ordinary edit is fixing what the item SAYS, so it opens the same
    // three fields it was planned with. The full form is one click further on.
    onEdit: mayEdit(r) ? () => setEditingItem(r) : undefined,
    onDelete: mayEdit(r) ? () => setDeleting(r) : undefined,
    // Naming somebody and CHANGING that name are the same right: whoever runs
    // the item. Without the second one a mis-assignment could only be undone
    // by deleting the item and planning it again.
    //
    // The one shortcut is a member of the owed team taking unclaimed work,
    // which needs no dialog - there is only one name it could be.
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
    // Logging work is the maker's act, and only while there is work left to
    // log: an accepted row is closed, and a delivered one is waiting on the
    // client rather than on anybody here.
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
          {/* ── Header ───────────────────────────────────────────────────────
              One line: what you can DO on the left, how you want to LOOK at it
              on the right. The tab bar above already says Deliverables, so a
              heading repeating the tab you just clicked earns no space. */}
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeField value={range} onChange={setRange} />
            <DeliverablesExportMenu filters={{ ...filters, projectId }} />
            {/* Planning is the ACCOUNT MANAGER's act - it is a promise made to
              a client on the whole project's behalf, not a team's own
              scheduling. The server enforces the same rule; this only
              decides whether the button is drawn.
              Logging output has no button here on purpose: output is
              recorded against the row that was owed, or off the task that
              produced it, so that the evidence lands on the commitment
              instead of beside it. */}
            {canManage && (
              <Button className="gap-1.5" onClick={() => setPlanOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Plan deliverable
              </Button>
            )}
            {/* Card or table. The filters that sat beside it are gone: the board
                is one row per period, and a handful of periods is a list you
                read rather than one you search. */}
            <ViewToggle value={view} onChange={setView} className="ml-auto" />
          </div>
        </>
      )}

      {/* ── One deliverable, on its page ───────────────────────────────── */}
      {periodKey &&
        (focused ? (
          <>
            {renderHeader?.(
              canManage && focused.key !== UNPLANNED_KEY ? (
                <>
                  {/* More items for THIS window - the plan dialog with step one
                      already answered. What it creates joins what is here. */}
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
            {/* One tab per team. The account manager reads a period as "what
                does WEB owe, what does VIDEO owe", and a team manager only ever
                wants their own. Keyed by the period so a different deliverable
                opens on its own first team, not on whichever tab was last. */}
            {/* What is going on in this deliverable, before the detail of it:
                how much landed, how the rest is spread, which team is behind.
                Its team rows are the tab switcher, so a row worth reading is
                one click from the items behind it. */}
            <DeliverableTracker
              period={focused}
              activeTeam={activeTeam}
              onTeamSelect={setTeamTab}
            />

            <Tabs value={activeTeam} onValueChange={setTeamTab}>
              <TabsBar
                items={itemsByTeam.map((t) => ({
                  value: t.key,
                  label: t.name,
                  count: t.rows.length,
                }))}
              />
              {itemsByTeam.map((t) => (
                <TabsContent key={t.key} value={t.key}>
                  <Card>
                    <CardContent className="p-0">
                      <PeriodItemsTable rows={t.rows} rowProps={rowProps} hideTeam />
                    </CardContent>
                  </Card>
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

      {/* ── The board ───────────────────────────────────────────────────
          One row per deliverable - the working week the account manager
          planned. Owed and made share a period: the client was promised the
          week. The eye opens the period on its own page, where the items are
          shown in full. */}
      {!periodKey && (
        <Card>
          <CardContent className="p-0">
            {periods.length === 0 ? (
              emptyBoard
            ) : view === "table" ? (
              <PeriodTable
                periods={pagedPeriods}
                serialOffset={(page - 1) * PERIODS_PER_PAGE}
                hrefFor={hrefFor}
                onDeletePeriod={canManage ? setDeletingPeriod : undefined}
              />
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
              className="border-t px-4 py-2"
            />
            {data?.truncated && (
              <p className="text-muted-foreground border-border/60 border-t px-4 py-2 text-[11px]">
                Showing the latest {rows.length} of {data.entries} items. Narrow the range to see
                the rest; the counts above cover all of them.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <EditItemDialog
        projectId={projectId}
        row={editingItem}
        onClose={() => setEditingItem(null)}
      />

      <PlanPeriodDialog
        projectId={projectId}
        open={planOpen}
        onOpenChange={setPlanOpen}
        // What is already planned, so a week says so before it is picked again.
        existing={periods}
        // On a deliverable page the window is already chosen: the dialog adds
        // items to it instead of asking which week.
        period={
          periodKey && focused?.start && focused?.end
            ? { start: focused.start, end: focused.end }
            : undefined
        }
      />

      {/* Delivering is the moment the proof goes on. The form in log mode asks
          for the link or file and the day, and lands the item as DELIVERED in
          one save - not a status flip and then an edit. */}
      <LogWorkDialog projectId={projectId} row={loggingRow} onClose={() => setLogging(null)} />

      {assigning && (
        <AssignDialog
          row={assigning}
          people={membersOf(assigning.team?.id)}
          pending={m.update.isPending}
          // The server refuses to take the maker off something already made,
          // and it needs a team to hand the work back to. Offering the option
          // and then failing would be the worse of the two.
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
          // One request per item; the board refetches once they have all gone.
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
