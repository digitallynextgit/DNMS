"use client"

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Cake,
  CalendarOff,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Link as LinkIcon,
  Loader2,
  Lock,
  PartyPopper,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  TaskStatusReasonDialog,
  type TaskStatusPayload,
} from "@/features/projects/components/task-status-reason-dialog"
import { TaskHistoryDialog } from "@/features/projects/components/task-history-dialog"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { TASK_STATUS_LABELS, TASK_WORKFLOW_STATUSES } from "@/lib/constants"
import { formatHours } from "@/features/projects/lib/format-hours"
import {
  ADHOC_DESCRIPTION,
  ADHOC_LABEL,
  ADHOC_ROW_ID,
  canDeleteTask,
  canEditTaskDetails,
  resolveTaskManagerId,
  taskEditLockReason,
  taskEditWindowLeft,
} from "@/features/projects/lib/task-permissions"
import { isWithinEditWindow, TASK_EDIT_WINDOW_MS } from "@/lib/edit-window"
import { useCommitOnOutsidePointer } from "@/hooks/use-commit-on-outside-pointer"
import { TaskResources } from "@/features/projects/components/task-resources"
import { dedupeLinks, isSafeHttpUrl, linkLabel } from "@/features/projects/lib/task-links"
// From the module, not the leave barrel: the barrel re-exports every leave
// COMPONENT, and this sheet needs two hooks.
import { useAwayDays, useTeamAwayDays, type AwayDay } from "@/features/leave/hooks/use-away-days"
import { followUpConflictFrom } from "@/features/projects/lib/follow-up-conflict"
import { useFollowUpConflictStore } from "@/stores/follow-up-conflict-store"
import type { ProjectTeam } from "@/features/projects/hooks/use-projects"

// =============================================================================
// The allocation sheet: the weekly Excel the team already plans in, as a live
// grid. Each day is a group of four columns, the same ones the spreadsheet has:
//
//   PLAN    what you intend to do   -> task titles, one per line, with the
//                                      allocation written inline as "@2h"
//   ACTUAL  what you actually did   -> a note per task
//   HRS     allocated vs spent      -> allocated is yours to set; spent is
//                                      measured off the task clock, never typed
//   RESOURCES  where the work lives -> the brief, the doc, the published page
//
// Tasks are NUMBERED, not bulleted, and the numbers are what tie the three
// columns together: "3." in Hrs is the time for "3." in Plan, whether or not
// the lines happen to wrap to the same height. Every line is coloured by its
// status, so the sheet reads as a progress report as well as a plan.
//
// ROWS are one of two things - see SheetAxis. My Tasks reads down one person's
// CLIENTS; a project's Tasks tab reads down that account's PEOPLE. It is the
// same week, the same cells and the same rules either way, which is why there
// is one component and not two that would have drifted apart immediately.
// =============================================================================

export interface SheetTask {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  estimatedHours: number | null
  loggedHours: number
  /** The Resources column: brief, doc, published page. Stored as URLs. */
  links: string[]
  /** Non-null while the task sits In Progress and its clock is running. */
  inProgressSince: string | null
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
  /** Who raised it, and when - together these decide the 15-minute window. */
  creatorId: string
  createdAt: string
  /** Null for ADHOC work: it belongs to no client and lands in the Adhoc row. */
  project: { id: string; name: string; code: string; slug: string | null } | null
  team?: { id: string; name: string; managerId: string | null } | null
  /**
   * managerId is the authority on adhoc work, which has no team manager. The
   * name is read only on the person axis, and only to label a row for someone
   * who has left the team but still has work sitting on the board.
   */
  assignee?: {
    id: string
    managerId?: string | null
    firstName?: string
    lastName?: string
  } | null
}

export interface SheetProject {
  id: string
  name: string
  code: string
}

/**
 * The row a task belongs to.
 *
 * On the CLIENT axis that is its project - adhoc work has none, so it collects
 * under a sentinel row instead. On the PERSON axis it is whoever the work is
 * assigned to, with a sentinel again for work nobody owns: an unassigned task is
 * exactly what a manager goes looking for, so it gets a row rather than being
 * quietly dropped off the sheet.
 */
function rowIdOf(task: SheetTask, by: SheetAxis["by"]): string {
  return by === "client"
    ? (task.project?.id ?? ADHOC_ROW_ID)
    : (task.assignee?.id ?? UNASSIGNED_ROW_ID)
}

/** The person axis's counterpart to ADHOC_ROW_ID: work with no owner. */
const UNASSIGNED_ROW_ID = "__unassigned__"

/**
 * The frozen-pane edge on the pinned Client column: a double-weight border plus
 * a soft shadow, so it reads as a column the rest of the sheet scrolls UNDER
 * rather than as just another cell boundary.
 */
const STICKY_EDGE = "sticky left-0 border-r-2 shadow-[4px_0_6px_-4px_rgb(0_0_0/0.45)]"

/** Status is carried by the colour of the whole line, number included. */
const STATUS_TEXT: Record<string, string> = {
  TODO: "text-foreground",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400",
  IN_REVIEW: "text-amber-600 dark:text-amber-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  CANCELLED: "text-muted-foreground",
  ON_HOLD: "text-amber-600 dark:text-amber-400",
  DISCARDED: "text-red-600 dark:text-red-400",
}

/** Struck through because the work is over, one way or the other. */
const STATUS_CLOSED = new Set(["DONE", "DISCARDED", "CANCELLED"])

/**
 * The shape the edit/delete rules read, pulled off a sheet row. The manager is
 * resolved the same way the API resolves it - the team's for project work, the
 * assignee's line manager for adhoc - so the controls shown here match what the
 * server will actually allow.
 */
function subjectOf(task: SheetTask) {
  return {
    creatorId: task.creatorId,
    createdAt: task.createdAt,
    // Null project = adhoc, which is what lets someone keep editing work they
    // raised for themselves. Must be the real value, never a fallback.
    projectId: task.project?.id ?? null,
    assigneeId: task.assignee?.id ?? null,
    teamManagerId: resolveTaskManagerId({
      teamId: task.team?.id ?? null,
      teamManagerId: task.team?.managerId,
      assigneeManagerId: task.assignee?.managerId,
    }),
  }
}

const NO_DATE = "none"

// ── Dates ────────────────────────────────────────────────────────────────────

/** Local calendar day of an ISO date, e.g. "2026-08-03". */
function dayKey(iso: string | null): string {
  if (!iso) return NO_DATE
  return toKey(new Date(iso))
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** The Monday of the week `d` falls in. Weeks are planned Monday-first. */
export function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  // getDay() is Sunday-first; shift so Monday is 0 and Sunday closes the week.
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

// ── Time ─────────────────────────────────────────────────────────────────────

/** Banked time plus the stretch currently running, in hours. */
function spentHours(task: SheetTask): number {
  const live = task.inProgressSince
    ? Math.max(0, Date.now() - new Date(task.inProgressSince).getTime()) / 3_600_000
    : 0
  return (task.loggedHours ?? 0) + live
}

const DURATION =
  /^([0-9]*\.?[0-9]+)\s*(h|hr|hrs|m|min|mins)?(?:\s*([0-9]{1,2})\s*(?:m|min|mins))?$/i

/**
 * "2h", "2", "90m", "1h30m", "1.5h" -> decimal hours. A bare number is HOURS,
 * which is how the allocation sheet has always been written. Anything that is
 * not a duration returns null rather than a guess.
 */
export function parseDuration(text: string): number | null {
  const m = text.trim().match(DURATION)
  if (!m) return null
  const n = parseFloat(m[1]!)
  if (!Number.isFinite(n) || n < 0) return null
  const unit = (m[2] ?? "h").toLowerCase()
  let hours = unit.startsWith("m") ? n / 60 : n
  if (m[3]) hours += parseInt(m[3], 10) / 60
  if (hours <= 0) return null
  // 2dp so 20 minutes stores as 0.33, matching the task dialog's rounding.
  return Math.round(hours * 100) / 100
}

/** The compact form the cell writes back, e.g. 1.5 -> "1h30m". */
function formatToken(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h${mins}m`
}

// ── Plan text <-> tasks ──────────────────────────────────────────────────────

/**
 * A leading "1. " / "12) ". The lookahead is what keeps "1.5h review" and
 * "2026 audit plan" intact - a number is only numbering when whitespace (or the
 * end of the line) follows the dot.
 */
const NUMBERING = /^\s*\d{1,3}[.)](?=$|\s)\s*/

/**
 * Strip the numbering the cell prints back off, so typing "1. Fix cart" the way
 * you would in Excel does not store a task literally called "1. Fix cart".
 */
function stripNumbering(line: string): string {
  return line.replace(NUMBERING, "").trim()
}

// ── Live numbering inside the editor ─────────────────────────────────────────
//
// The numbers are part of the text while you type, not a gutter drawn beside
// it: cells are narrow, lines wrap, and a gutter would drift out of alignment
// on the first wrapped line. Everything below keeps that text canonical -
// renumbered on every keystroke - without the caret jumping around.

/** The lines with any numbering removed. The text the user is really editing. */
function toBareLines(value: string): string[] {
  return value.split("\n").map((l) => l.replace(NUMBERING, ""))
}

function numberLines(bare: string[]): string {
  return bare.map((l, i) => `${i + 1}. ${l}`).join("\n")
}

/** Where a caret offset lands, as a line index and a column inside it. */
function locate(value: string, caret: number): { line: number; col: number } {
  const lines = value.split("\n")
  let col = caret
  for (let i = 0; i < lines.length; i++) {
    if (col <= lines[i]!.length) return { line: i, col }
    col -= lines[i]!.length + 1
  }
  const last = lines.length - 1
  return { line: last, col: lines[last]!.length }
}

/** The inverse: a (line, col) on bare text back to an offset in numbered text. */
function caretFor(bare: string[], line: number, col: number): number {
  let n = 0
  for (let i = 0; i < line; i++) n += `${i + 1}. `.length + bare[i]!.length + 1
  return n + `${line + 1}. `.length + Math.min(col, bare[line]?.length ?? 0)
}

interface PlanLine {
  title: string
  /** Hours allocated on this line, or null when no "@…" was written. */
  hours: number | null
}

const AT_SUFFIX = /\s+@\s*(\S[^@]*)$/

/**
 * One typed line -> a task and its allocation. The allocation is written where
 * the work is written - "Fix cart @2h" - so planning is one keystroke run, not
 * a trip through a dialog. A trailing "@…" that is not a duration ("email
 * @vendor") is left alone as part of the title.
 */
function parsePlanLine(raw: string): PlanLine {
  const line = stripNumbering(raw)
  const m = line.match(AT_SUFFIX)
  if (m && m.index !== undefined) {
    const hours = parseDuration(m[1]!)
    const title = line.slice(0, m.index).trim()
    if (hours !== null && title) return { title, hours }
  }
  return { title: line, hours: null }
}

/** The one spelling of a line: "title" or "title @2h". */
function canonicalLine(line: PlanLine): string {
  return line.hours ? `${line.title} @${formatToken(line.hours)}` : line.title
}

/** How a task reads back in the editable cell - the exact inverse of the parse. */
function planLineOf(task: SheetTask): string {
  return canonicalLine({ title: task.title, hours: task.estimatedHours ?? null })
}

/** A change to one existing task. Absent keys are left as they are. */
interface TaskUpdate {
  task: SheetTask
  title?: string
  estimatedHours?: number | null
}

/**
 * What a single Plan cell edit turns into. Titles are matched to existing tasks
 * before anything is written, so re-ordering lines or deleting one from the
 * middle does not silently re-label somebody else's work.
 */
interface CellPlan {
  projectId: string
  projectName: string
  /** Who the new tasks are raised on - the row's person. */
  assigneeId: string
  /** The row's heading, for the message when nothing can be filed there. */
  rowName: string
  /** Which cell is busy while this runs, and which to unblock when it is done. */
  cellKey: string
  /** The day the new tasks are due, or null for the undated column. */
  dueDate: string | null
  creates: PlanLine[]
  updates: TaskUpdate[]
  deletes: SheetTask[]
}

function diffCell(lines: PlanLine[], existing: SheetTask[]) {
  const pool = [...existing]
  const unmatched: PlanLine[] = []
  const creates: PlanLine[] = []
  const updates: TaskUpdate[] = []

  /** The cell owns the allocation: no "@…" on the line means none allocated. */
  function hoursChange(task: SheetTask, hours: number | null) {
    const current = task.estimatedHours ?? null
    if ((hours ?? null) === current) return undefined
    return { estimatedHours: hours }
  }

  // Pass 1 - a line that still reads exactly like a task IS that task, wherever
  // it now sits in the cell. This is what makes re-ordering a no-op.
  for (const line of lines) {
    const i = pool.findIndex((t) => t.title === line.title)
    if (i < 0) {
      unmatched.push(line)
      continue
    }
    const [task] = pool.splice(i, 1)
    const hours = hoursChange(task!, line.hours)
    if (hours) updates.push({ task: task!, ...hours })
  }
  // Pass 2 - leftovers pair up in order: an edited line keeps its task (and so
  // its status, spent time and history) instead of being deleted and recreated.
  for (const line of unmatched) {
    const task = pool.shift()
    if (!task) {
      creates.push(line)
      continue
    }
    updates.push({ task, title: line.title, ...hoursChange(task, line.hours) })
  }
  return { creates, updates, deletes: pool }
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Re-render on a beat while any clock is running, so the Hrs column does not
 * sit frozen at the value it had when the page loaded. 30s is under the
 * smallest unit displayed (a minute), so the number is never visibly stale.
 */
function useTick(active: boolean, everyMs = 30_000): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  // Returned so a derived value that depends on elapsed time can list it as a
  // dependency, instead of being recomputed on EVERY render to stay live.
  return tick
}

/**
 * Size the box to what is in it - and, when it is a cell editor, to the cell.
 *
 * Two things are being avoided. A fixed-height textarea starts scrolling the
 * moment the plan runs past its rows, hiding the very lines you are writing.
 * And a purely content-sized one leaves the editor floating inside a taller
 * row, so only part of the cell is actually the text box. Taking the larger of
 * the two means the editor always IS the cell, and the row grows with it.
 */
function useAutoGrow(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  active: boolean,
  /** Stretch to the parent cell as well. Only for a textarea that IS the cell. */
  fillParent = false,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    // Collapse first: reading scrollHeight then flushes layout, so the parent
    // measurement below is the row's real height rather than a stale one held
    // open by this very element.
    el.style.height = "auto"
    // +2 covers the outline/rounding, so the last line never sits half-clipped
    // and re-introduces the scrollbar we are removing.
    const needed = el.scrollHeight + 2
    const cell = fillParent && el.parentElement ? el.parentElement.clientHeight : 0
    el.style.height = `${Math.max(needed, cell)}px`
  }, [ref, value, active, fillParent])
}

// ── Component ────────────────────────────────────────────────────────────────

/** A person the sheet can put on a row. */
export interface SheetPerson {
  id: string
  name: string
  /** The muted second line - their team on this project, or their role. */
  caption?: string
  /**
   * May the viewer write NEW work into this row?
   *
   * Editing what is already there is decided per task, from the task's own
   * rules. This is the one thing those rules cannot answer, because there is no
   * task yet - so it mirrors what the create endpoint allows: your own row, a
   * row on a team you manage, or anyone's if you administer the project.
   */
  canPlan?: boolean
}

/**
 * What a ROW is, and therefore what a cell means.
 *
 *   client   one person's week across their accounts   - My Tasks
 *   person   one account's week across its people      - a project's Tasks tab
 *
 * Everything else about the grid is identical, which is exactly why this is one
 * component: two sheets would have drifted apart on the first change to either.
 */
export type SheetAxis =
  | {
      by: "client"
      /** Row order: every project this person is on, even the empty ones. */
      projects: SheetProject[]
      /** Who new tasks are raised on - the person whose sheet this is. */
      assigneeId: string
      /** Show the Adhoc row - hidden when the filter has narrowed to one client. */
      showAdhoc?: boolean
    }
  | {
      by: "person"
      /** The account every row is planned against. */
      project: SheetProject
      /** Row order: the people on it, including the ones with a blank week. */
      people: SheetPerson[]
    }

interface Props {
  /** Already filtered by project/status. Not filtered by date - the grid slices. */
  tasks: SheetTask[]
  /** Whether rows are clients or people - see SheetAxis. */
  axis: SheetAxis
  /** The signed-in user, used to prefer a team they manage when filing. */
  currentUserId: string
  /** Project admin (PROJECT_WRITE): edits and deletes without restriction. */
  isAdmin?: boolean
  /** Read-only when the sheet shows a whole team rather than one person. */
  readOnly?: boolean
  /**
   * Open a task's full record - comments, checklist, files. Offered from the
   * line's status menu when given: there is no room for a button per line, and
   * the number is already that line's one affordance.
   */
  onOpenTask?: (task: SheetTask) => void
}

/** One row of the grid, whichever axis built it. */
interface SheetRow {
  /** Row key: a project id on the client axis, an employee id on the person one. */
  id: string
  name: string
  /** The muted second line: a project code, or the person's team. */
  caption: string
  /** Where work typed into this row is filed, and on whom. */
  projectId: string
  projectName: string
  assigneeId: string
  /**
   * Whose leave explains a quiet cell on this row. Empty on client rows - the
   * whole sheet is one person there, so their week is said once in the header
   * rather than repeated in every cell under it.
   */
  awayOf: string
  /** A bucket rather than a real row: adhoc work, or work with no owner. */
  muted: boolean
  /** Hover text for the row heading - what that bucket collects. */
  hint?: string
  canPlan: boolean
}

export function TasksSheetView({
  tasks,
  axis,
  currentUserId,
  isAdmin = false,
  readOnly = false,
  onOpenTask,
}: Props) {
  const qc = useQueryClient()
  const askFollowUpConflict = useFollowUpConflictStore((s) => s.ask)
  const [weekStart, setWeekStart] = useState(() => toKey(mondayOf(new Date())))
  const [busyCells, setBusyCells] = useState<Record<string, boolean>>({})
  /** A Plan edit that would delete tasks, held until it is confirmed. */
  const [pendingPlan, setPendingPlan] = useState<CellPlan | null>(null)
  /** A status pick that still needs its reason (and hold date) collected. */
  const [pendingStatus, setPendingStatus] = useState<{
    task: SheetTask
    mode: "ON_HOLD" | "DISCARDED"
  } | null>(null)

  const thisMonday = toKey(mondayOf(new Date()))
  const todayKey = toKey(new Date())

  // Beat along while a clock is running OR an edit window is still open, so a
  // line locks itself the moment its 15 minutes are up rather than staying
  // editable-looking until the next refetch.
  const tick = useTick(
    tasks.some(
      (t) => t.inProgressSince || isWithinEditWindow(t.createdAt, Date.now(), TASK_EDIT_WINDOW_MS),
    ),
  )

  const actor = useMemo(() => ({ userId: currentUserId, isAdmin }), [currentUserId, isAdmin])
  const mayEdit = (task: SheetTask) => !readOnly && canEditTaskDetails(subjectOf(task), actor)
  const mayDelete = (task: SheetTask) => !readOnly && canDeleteTask(subjectOf(task), actor)

  /**
   * What to say about a line's editability on hover: the reason it is shut, or
   * the time left while it is open. The window is far less surprising when you
   * can watch it run down than when it simply refuses you afterwards.
   */
  function editHint(task: SheetTask): string | undefined {
    if (readOnly) return undefined
    if (!mayEdit(task)) return taskEditLockReason(subjectOf(task), actor) ?? undefined
    if (task.creatorId !== currentUserId) return undefined
    // Your own adhoc work never expires, so a countdown here would promise a
    // deadline that does not exist.
    if (!task.project && task.assignee?.id === currentUserId) return "Yours to edit"
    const left = taskEditWindowLeft(subjectOf(task))
    return left ? `Yours to edit - ${left}` : undefined
  }

  // Mon-Fri: the working week the allocation sheet is written in. A weekend day
  // appears only when it actually has work on it, so a normal week is five
  // columns wide and a Saturday task is still never silently hidden.
  const days = useMemo(() => {
    const start = fromKey(weekStart)
    const dates = Array.from({ length: 5 }, (_, i) => addDays(start, i))
    for (const offset of [5, 6]) {
      const weekendDay = addDays(start, offset)
      if (tasks.some((t) => dayKey(t.dueDate) === toKey(weekendDay))) dates.push(weekendDay)
    }
    return dates.map((d) => ({
      key: toKey(d),
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      sub: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    }))
  }, [weekStart, tasks])

  const hasUndated = useMemo(() => tasks.some((t) => !t.dueDate), [tasks])
  const columns = useMemo(
    () => (hasUndated ? [...days, { key: NO_DATE, label: "No date", sub: "unscheduled" }] : days),
    [days, hasUndated],
  )

  const weekKeys = useMemo(() => new Set(columns.map((c) => c.key)), [columns])

  // row id + day -> the tasks written in that cell.
  const cells = useMemo(() => {
    const map = new Map<string, SheetTask[]>()
    for (const t of tasks) {
      const key = dayKey(t.dueDate)
      if (!weekKeys.has(key)) continue
      const cellKey = `${rowIdOf(t, axis.by)}|${key}`
      const list = map.get(cellKey)
      if (list) list.push(t)
      else map.set(cellKey, [t])
    }
    return map
  }, [tasks, weekKeys, axis.by])

  /**
   * The rows, in the order they are read.
   *
   * CLIENT axis: every project the person is on, plus any project that has work
   * in this week but is missing from that list (e.g. a task filed on a project
   * they have since left). Adhoc is pinned LAST rather than sorted in: it is not
   * a client, and having it land between two real accounts alphabetically is
   * what made the old ADHOC project read as one.
   *
   * PERSON axis: everyone on the project, plus - by the same rule, so nobody's
   * week can vanish - anyone with work this week who is no longer on a team. An
   * Unassigned bucket is pinned last, and only when the week has work in it.
   */
  const rows = useMemo<SheetRow[]>(() => {
    if (axis.by === "client") {
      const byId = new Map<string, SheetProject>()
      for (const p of axis.projects) byId.set(p.id, p)
      for (const t of tasks) {
        if (t.project && !byId.has(t.project.id) && weekKeys.has(dayKey(t.dueDate))) {
          byId.set(t.project.id, t.project)
        }
      }
      const clients: SheetRow[] = [...byId.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({
          id: project.id,
          name: project.name,
          caption: project.code,
          projectId: project.id,
          projectName: project.name,
          assigneeId: axis.assigneeId,
          awayOf: "",
          muted: false,
          canPlan: true,
        }))
      if (axis.showAdhoc === false) return clients
      return [
        ...clients,
        {
          id: ADHOC_ROW_ID,
          name: ADHOC_LABEL,
          caption: "no client",
          projectId: ADHOC_ROW_ID,
          projectName: ADHOC_LABEL,
          assigneeId: axis.assigneeId,
          awayOf: "",
          muted: true,
          hint: ADHOC_DESCRIPTION,
          canPlan: true,
        },
      ]
    }

    const { project, people } = axis
    const byId = new Map<string, SheetPerson>()
    for (const person of people) byId.set(person.id, person)
    for (const t of tasks) {
      const person = t.assignee
      if (!person || byId.has(person.id) || !weekKeys.has(dayKey(t.dueDate))) continue
      byId.set(person.id, {
        id: person.id,
        name: `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || "Former member",
        // Their work is still here, but there is no team to file anything new
        // under - which is also why the row cannot be planned into.
        caption: "not on a team",
      })
    }
    const staff: SheetRow[] = [...byId.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((person) => ({
        id: person.id,
        name: person.name,
        caption: person.caption ?? "",
        projectId: project.id,
        projectName: project.name,
        assigneeId: person.id,
        awayOf: person.id,
        muted: false,
        canPlan: person.canPlan ?? false,
      }))

    const hasOrphans = tasks.some((t) => !t.assignee && weekKeys.has(dayKey(t.dueDate)))
    if (!hasOrphans) return staff
    return [
      ...staff,
      {
        id: UNASSIGNED_ROW_ID,
        name: "Unassigned",
        caption: "no owner yet",
        projectId: project.id,
        projectName: project.name,
        assigneeId: "",
        awayOf: "",
        muted: true,
        hint: "Work on this project that nobody is down to do",
        // There is nobody to raise it ON. Giving this work an owner is what the
        // row is asking for, and that happens on the task itself.
        canPlan: false,
      },
    ]
  }, [axis, tasks, weekKeys])

  // Why a cell is quiet: leave, a half day, or a holiday.
  //
  // One person's sheet is read once and marked across the COLUMN headers - it is
  // their week, end to end. A whole team's is read for every row in one request
  // and marked per CELL instead, because one person being off is not the team's
  // empty day.
  const from = days[0]?.key
  const to = days[days.length - 1]?.key
  const { data: soloAway } = useAwayDays(
    axis.by === "client" ? axis.assigneeId : undefined,
    from,
    to,
  )
  const teamAwayIds = useMemo(() => rows.filter((r) => r.awayOf).map((r) => r.awayOf), [rows])
  const { data: teamAway } = useTeamAwayDays(teamAwayIds, from, to)

  const awayByRow = useMemo(() => {
    const map = new Map<string, Map<string, AwayDay>>()
    for (const [id, list] of Object.entries(teamAway ?? {})) {
      map.set(id, new Map(list.map((d) => [d.date, d])))
    }
    return map
  }, [teamAway])

  /**
   * What the column header says. One person's sheet: their own week. A team's:
   * only what is true of everybody, which is a public holiday - one person's
   * leave belongs on their row, not painted over the whole column.
   */
  const awayByDay = useMemo(() => {
    if (axis.by === "client") return new Map((soloAway ?? []).map((d) => [d.date, d]))
    const map = new Map<string, AwayDay>()
    const ids = [...awayByRow.keys()]
    if (ids.length === 0) return map
    for (const c of columns) {
      const first = awayByRow.get(ids[0]!)?.get(c.key)
      if (first?.status !== "holiday") continue
      if (ids.every((id) => awayByRow.get(id)?.get(c.key)?.label === first.label)) {
        map.set(c.key, first)
      }
    }
    return map
  }, [axis.by, soloAway, awayByRow, columns])

  const weekLabel = useMemo(() => {
    const start = fromKey(weekStart)
    // The last column that is actually rendered, not start+N: a lone Sunday
    // task extends the grid past Friday without adding a Saturday.
    const end = fromKey(days[days.length - 1]?.key ?? weekStart)
    const fmt = (d: Date, withYear: boolean) =>
      d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      })
    return `${fmt(start, false)} – ${fmt(end, true)}`
  }, [weekStart, days])

  /**
   * Which team to file a new task under. The API needs one, and it must be a
   * team the ASSIGNEE belongs to - preferring one the caller manages, since that
   * is the only route that does not park the task in an approval queue.
   *
   * The assignee is the ROW's on the person axis and the sheet's owner on the
   * client one, so it is passed in rather than read off the component.
   */
  async function resolveTeamId(projectId: string, assigneeId: string): Promise<string | null> {
    const res = await qc.fetchQuery({
      queryKey: ["project-teams", projectId],
      queryFn: () => apiFetch<{ data: ProjectTeam[] }>(`/api/projects/${projectId}/teams`),
      staleTime: 60_000,
    })
    const teams = res?.data ?? []
    const withAssignee = teams.filter((t) => t.members.some((m) => m.employeeId === assigneeId))
    const picked = withAssignee.find((t) => t.managerId === currentUserId) ?? withAssignee[0]
    return picked?.id ?? null
  }

  function setBusy(cellKey: string, on: boolean) {
    setBusyCells((b) => {
      if (on) return { ...b, [cellKey]: true }
      const next = { ...b }
      delete next[cellKey]
      return next
    })
  }

  async function runPlan(plan: CellPlan, cellKey: string) {
    setBusy(cellKey, true)
    let created = 0
    let updated = 0
    let removed = 0
    const failures: string[] = []

    try {
      for (const { task, title, estimatedHours } of plan.updates) {
        try {
          await apiFetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(title !== undefined && { title }),
              ...(estimatedHours !== undefined && { estimatedHours }),
            }),
          })
          updated++
        } catch (e) {
          failures.push(e instanceof Error ? e.message : "Could not update a task")
        }
      }

      for (const task of plan.deletes) {
        try {
          await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" })
          removed++
        } catch (e) {
          failures.push(e instanceof Error ? e.message : "Could not remove a task")
        }
      }

      if (plan.creates.length > 0) {
        // Adhoc work belongs to no project and no team, so it goes to the plain
        // task endpoint; everything else has to be filed under a team.
        const adhoc = plan.projectId === ADHOC_ROW_ID
        const teamId = adhoc ? null : await resolveTeamId(plan.projectId, plan.assigneeId)
        if (!adhoc && !teamId) {
          failures.push(
            axis.by === "person"
              ? `No team in ${plan.projectName} with ${plan.rowName} on it`
              : `No team in ${plan.projectName} you can file a task in`,
          )
        } else {
          const url = adhoc ? `/api/tasks` : `/api/projects/${plan.projectId}/teams/${teamId}/tasks`
          for (const line of plan.creates) {
            try {
              await apiFetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: line.title,
                  assigneeId: plan.assigneeId,
                  dueDate: plan.dueDate ?? undefined,
                  estimatedHours: line.hours ?? undefined,
                }),
              })
              created++
            } catch (e) {
              failures.push(e instanceof Error ? e.message : "Could not add a task")
            }
          }
        }
      }
    } finally {
      setBusy(cellKey, false)
      // Always refetch: a cell that failed must snap back to what is actually
      // stored rather than keep showing the text that was rejected.
      await qc.invalidateQueries({ queryKey: ["my-tasks"] })
      if (plan.projectId !== ADHOC_ROW_ID) {
        qc.invalidateQueries({ queryKey: ["project-all-tasks", plan.projectId] })
      }
    }

    if (failures.length > 0) {
      toast.error(failures[0]!, {
        description: failures.length > 1 ? `and ${failures.length - 1} more` : undefined,
      })
      return
    }
    const parts = [
      created > 0 && `${created} added`,
      updated > 0 && `${updated} updated`,
      removed > 0 && `${removed} removed`,
    ].filter(Boolean)
    if (parts.length > 0) toast.success(parts.join(" · "))
  }

  function commitPlan(row: SheetRow, columnKey: string, lines: PlanLine[]) {
    const cellKey = `${row.id}|${columnKey}|plan`
    const existing = cells.get(`${row.id}|${columnKey}`) ?? []
    const diff = diffCell(lines, existing)

    // Drop what this person may not do BEFORE sending anything, and say which
    // lines were dropped. Firing the requests and letting each come back 403
    // would half-apply the cell and explain nothing. Adding lines is always
    // allowed - a new task is theirs to raise.
    const updates = diff.updates.filter((u) => mayEdit(u.task))
    const deletes = diff.deletes.filter(mayDelete)
    const lockedEdits = diff.updates.filter((u) => !mayEdit(u.task))
    const lockedDeletes = diff.deletes.filter((t) => !mayDelete(t))

    if (lockedEdits.length > 0) {
      const [first] = lockedEdits
      toast.error(`"${first!.task.title}" can no longer be edited`, {
        description: taskEditLockReason(subjectOf(first!.task), actor) ?? undefined,
      })
    }
    if (lockedDeletes.length > 0) {
      toast.error(`"${lockedDeletes[0]!.title}" cannot be removed`, {
        description: "Only the team manager can delete a task. Ask them, or put it on hold.",
      })
    }

    const creates = diff.creates
    if (creates.length === 0 && updates.length === 0 && deletes.length === 0) {
      // Nothing survived the filter, but the cell text no longer matches what is
      // stored - pull it back so it stops showing an edit that did not happen.
      if (lockedEdits.length > 0 || lockedDeletes.length > 0) {
        void qc.invalidateQueries({ queryKey: ["my-tasks"] })
      }
      return
    }

    const plan: CellPlan = {
      projectId: row.projectId,
      projectName: row.projectName,
      assigneeId: row.assigneeId,
      rowName: row.name,
      cellKey,
      dueDate: columnKey === NO_DATE ? null : columnKey,
      creates,
      updates,
      deletes,
    }
    // Clearing a line is the one edit that destroys history, so it asks first.
    if (deletes.length > 0) setPendingPlan(plan)
    else void runPlan(plan, cellKey)
  }

  /** One field on one task, saved on its own. Used by Actual and by Allocated. */
  async function patchTask(
    task: SheetTask,
    body: Record<string, unknown>,
    cellKey: string,
    label: string,
  ) {
    setBusy(cellKey, true)
    const send = (payload: Record<string, unknown>) =>
      apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

    try {
      await send(body)
      toast.success(label)
    } catch (e) {
      // Moving a hold follow-up whose original is already underway is a question
      // for the user, not an error - see follow-up-conflict.ts.
      const conflict = followUpConflictFrom(e)
      if (conflict) {
        askFollowUpConflict({
          ...conflict,
          keep: async () => {
            await send({ ...body, keepFollowUp: true })
            toast.success(label)
            await qc.invalidateQueries({ queryKey: ["my-tasks"] })
          },
        })
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save")
      }
    } finally {
      setBusy(cellKey, false)
      await qc.invalidateQueries({ queryKey: ["my-tasks"] })
      // Adhoc work is in no project board, so there is nothing else to refresh.
      if (task.project) qc.invalidateQueries({ queryKey: ["project-all-tasks", task.project.id] })
    }
  }

  /**
   * Move one task to a new phase. On Hold and Discarded carry required context
   * (a reason, and for a hold the date it is expected by), so they route through
   * the same dialog the dropdown and the kanban board use rather than committing
   * a half-written record from a two-click menu.
   *
   * Saved against a key nothing renders, so the Plan cell keeps showing its list
   * instead of blanking to "Saving…" - the colour changing IS the feedback.
   */
  function pickStatus(task: SheetTask, next: string) {
    if (next === task.status) return
    if (next === "ON_HOLD" || next === "DISCARDED") {
      setPendingStatus({ task, mode: next })
      return
    }
    void patchTask(task, { status: next }, `${task.id}|status`, "Status updated")
  }

  // Per-day totals for the footer strip.
  //
  // This used to run on EVERY render - columns x rows x cells - because a
  // running clock changes `spentHours(t)` without changing columns/rows/cells,
  // so a memo keyed on those alone would freeze the footer while the row totals
  // ticked on. That reasoning was right; the missing piece was `tick`. With the
  // beat as a dependency the memo recomputes exactly when the numbers can
  // actually have changed - once every 30s, or when the data does - instead of
  // on every keystroke, hover and selection change.
  const { dayTotals, grand } = useMemo(() => {
    const totals: Record<string, { count: number; allocated: number; spent: number }> = {}
    for (const c of columns) {
      let count = 0
      let allocated = 0
      let spent = 0
      for (const r of rows) {
        for (const t of cells.get(`${r.id}|${c.key}`) ?? []) {
          count++
          allocated += t.estimatedHours ?? 0
          spent += spentHours(t)
        }
      }
      totals[c.key] = { count, allocated, spent }
    }
    return {
      dayTotals: totals,
      grand: Object.values(totals).reduce(
        (a, b) => ({ allocated: a.allocated + b.allocated, spent: a.spent + b.spent }),
        { allocated: 0, spent: 0 },
      ),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, rows, cells, tick])

  return (
    <div className="space-y-3">
      {/* Week stepper */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-semibold">{weekLabel}</span>
          {weekStart === thisMonday && (
            <span className="text-muted-foreground text-xs">· this week</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => setWeekStart(toKey(addDays(fromKey(weekStart), -7)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={weekStart === thisMonday}
            onClick={() => setWeekStart(thisMonday)}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => setWeekStart(toKey(addDays(fromKey(weekStart), 7)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground rounded-[2px] border border-dashed p-8 text-center text-sm">
          {axis.by === "person"
            ? "Nobody is on this project yet - add a team first."
            : "No projects to plan against."}
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-[2px] border">
          {/* This grid is genuinely spreadsheet-shaped - seven day columns cannot
              become a phone card without losing the week-at-a-glance that is the
              whole point. So it stays a scrolling sheet with the Client column
              pinned, and says so rather than leaving the swipe to be discovered. */}
          <p className="text-muted-foreground border-b px-3 py-1.5 text-[11px] sm:hidden">
            Swipe sideways to see the rest of the week →
          </p>
          {/* border-SEPARATE, not collapse: a collapsed border belongs to the
              table, not to the cell that declares it, so the Client column's
              right edge painted underneath the sticky cell and slid away with
              the scroll - leaving the pinned column visually merged into the
              day columns. Separated borders stay with their cell. Every cell
              draws only its right and bottom edge, so nothing doubles up. */}
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/60">
                {/* Solid, not the row's translucent tint: cells scroll UNDER
                    this column and a see-through header shows them doing it. */}
                <th
                  rowSpan={2}
                  className={cn(
                    "bg-muted z-20 w-28 min-w-28 border-b px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase sm:w-40 sm:min-w-40",
                    STICKY_EDGE,
                  )}
                >
                  {axis.by === "person" ? "Employee" : "Client"}
                </th>
                {columns.map((c) => {
                  const away = awayByDay.get(c.key)
                  return (
                    <th
                      key={c.key}
                      colSpan={4}
                      className={cn(
                        "border-r border-b px-3 py-1.5 text-center text-[11px] font-semibold tracking-wide uppercase",
                        c.key === todayKey && "bg-primary/10",
                        c.key === NO_DATE && "text-muted-foreground",
                        // A day with nobody in is dimmed, so an empty column
                        // reads as "not here" rather than "did nothing".
                        away?.status !== "half-day" && away && "bg-muted/60",
                      )}
                    >
                      {c.label}
                      <span className="text-muted-foreground ml-1.5 font-normal normal-case">
                        {c.sub}
                      </span>
                      {/* Says WHY the column is empty. Icon + words, never colour
                          alone - and never the leave type, which is nobody's
                          business on a task board. */}
                      {away && (
                        <span
                          className={cn(
                            "mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium normal-case",
                            away.status === "half-day"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {away.status === "holiday" ? (
                            <PartyPopper className="h-3 w-3 shrink-0" />
                          ) : away.status === "birthday" ? (
                            <Cake className="h-3 w-3 shrink-0" />
                          ) : away.status === "half-day" ? (
                            <Clock3 className="h-3 w-3 shrink-0" />
                          ) : (
                            <CalendarOff className="h-3 w-3 shrink-0" />
                          )}
                          <span className="truncate">{away.label}</span>
                        </span>
                      )}
                    </th>
                  )
                })}
                <th
                  rowSpan={2}
                  className="w-24 border-b px-2 py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
                >
                  Week total
                </th>
              </tr>
              <tr className="bg-muted/40 text-muted-foreground text-[10px] tracking-wide uppercase">
                {columns.map((c) => (
                  <Fragment key={c.key}>
                    <th
                      className={cn(
                        "min-w-40 border-r border-b px-3 py-1 text-left font-medium",
                        c.key === todayKey && "bg-primary/10",
                      )}
                    >
                      Plan
                    </th>
                    <th
                      className={cn(
                        "min-w-40 border-r border-b px-3 py-1 text-left font-medium",
                        c.key === todayKey && "bg-primary/10",
                      )}
                    >
                      Actual
                    </th>
                    <th
                      className={cn(
                        "w-20 min-w-20 border-r border-b px-2 py-1 text-right font-medium",
                        c.key === todayKey && "bg-primary/10",
                      )}
                      title="Allocated hours, with time spent underneath"
                    >
                      Hrs
                    </th>
                    <th
                      className={cn(
                        "w-28 min-w-28 border-r border-b px-2 py-1 text-left font-medium sm:w-40 sm:min-w-40",
                        c.key === todayKey && "bg-primary/10",
                      )}
                      title="Brief, doc, published page"
                    >
                      Resources
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const rowTasks = columns.flatMap((c) => cells.get(`${row.id}|${c.key}`) ?? [])
                const rowAllocated = rowTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
                const rowSpent = rowTasks.reduce((s, t) => s + spentHours(t), 0)
                return (
                  <tr key={row.id} className={cn("align-top", row.muted && "bg-muted/20")}>
                    <th
                      scope="row"
                      // Tinted and captioned, so a bucket row - adhoc work, work
                      // with no owner - reads as one rather than as another
                      // account or another colleague on the list.
                      className={cn(
                        "z-10 border-b px-3 py-2 text-left align-top",
                        STICKY_EDGE,
                        // Opaque, always: cells scroll under this column, and a
                        // translucent tint would show them doing it.
                        row.muted ? "bg-muted" : "bg-card",
                      )}
                      title={row.hint}
                    >
                      <span className="block text-xs font-semibold">{row.name}</span>
                      <span className="text-muted-foreground block text-[10px]">{row.caption}</span>
                    </th>
                    {columns.map((c) => {
                      const cellTasks = cells.get(`${row.id}|${c.key}`) ?? []
                      const planKey = `${row.id}|${c.key}|plan`
                      const actualKey = `${row.id}|${c.key}|actual`
                      const hoursKey = `${row.id}|${c.key}|hours`
                      const resourcesKey = `${row.id}|${c.key}|resources`
                      const isToday = c.key === todayKey
                      // THIS person's absence. A day the whole sheet is out is
                      // already said once in the header, so it is not repeated
                      // in every cell underneath it.
                      const away = awayByDay.has(c.key)
                        ? undefined
                        : awayByRow.get(row.awayOf)?.get(c.key)
                      // One background per cell, picked here rather than stacked
                      // as competing classes - two bg utilities in one string win
                      // by stylesheet order, not by the order they are written.
                      const tint = away
                        ? away.status === "half-day"
                          ? "bg-amber-500/5"
                          : "bg-muted/50"
                        : isToday
                          ? "bg-primary/5"
                          : undefined
                      return (
                        <Fragment key={c.key}>
                          <td className={cn("border-r border-b p-0", tint)} title={away?.label}>
                            <PlanCell
                              tasks={cellTasks}
                              busy={!!busyCells[planKey]}
                              // A row you may not raise work in still SHOWS its
                              // work - and each line is still governed by its own
                              // rules. This only shuts the "type a new plan here"
                              // door the task rules cannot answer for.
                              readOnly={readOnly || !row.canPlan}
                              onCommit={(lines) => commitPlan(row, c.key, lines)}
                              onPickStatus={pickStatus}
                              canEdit={mayEdit}
                              editHint={editHint}
                              onOpenTask={onOpenTask}
                            />
                          </td>
                          <td className={cn("border-r border-b p-0", tint)} title={away?.label}>
                            <ActualCell
                              tasks={cellTasks}
                              busy={!!busyCells[actualKey]}
                              canEdit={mayEdit}
                              onCommit={(task, text) =>
                                patchTask(task, { description: text || null }, actualKey, "Saved")
                              }
                            />
                          </td>
                          <td className={cn("border-r border-b p-0", tint)} title={away?.label}>
                            <HoursCell
                              tasks={cellTasks}
                              busy={!!busyCells[hoursKey]}
                              canEdit={mayEdit}
                              onCommit={(task, hours) =>
                                patchTask(
                                  task,
                                  { estimatedHours: hours },
                                  hoursKey,
                                  hours === null ? "Allocation cleared" : "Allocation saved",
                                )
                              }
                            />
                          </td>
                          <td className={cn("border-r border-b p-0", tint)} title={away?.label}>
                            <ResourcesCell
                              tasks={cellTasks}
                              busy={!!busyCells[resourcesKey]}
                              readOnly={readOnly}
                              onCommit={(task, links) =>
                                patchTask(task, { links }, resourcesKey, "Resources saved")
                              }
                            />
                          </td>
                        </Fragment>
                      )
                    })}
                    <td className="border-b px-2 py-2 text-right text-xs tabular-nums">
                      {rowAllocated > 0 || rowSpent > 0 ? (
                        <>
                          <span className="block font-medium">
                            {rowAllocated > 0 ? formatHours(rowAllocated) : "–"}
                          </span>
                          <span className="text-muted-foreground block text-[10px]">
                            spent {rowSpent > 0 ? formatHours(rowSpent) : "0m"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="bg-muted/60">
                <th
                  className={cn(
                    "bg-muted z-10 px-3 py-2 text-left text-[11px] font-semibold tracking-wide uppercase",
                    STICKY_EDGE,
                  )}
                >
                  Daily total
                </th>
                {columns.map((c) => {
                  const t = dayTotals[c.key]!
                  return (
                    <Fragment key={c.key}>
                      <td className="text-muted-foreground border-r px-3 py-2 text-[11px] tabular-nums">
                        {t.count ? `${t.count} ${t.count === 1 ? "task" : "tasks"}` : "-"}
                      </td>
                      <td className="border-r px-3 py-2" />
                      <td className="border-r px-2 py-2 text-right text-[11px] tabular-nums">
                        <span className="block font-semibold">
                          {t.allocated > 0 ? formatHours(t.allocated) : "-"}
                        </span>
                        {t.spent > 0 && (
                          <span className="text-muted-foreground block text-[10px]">
                            {formatHours(t.spent)}
                          </span>
                        )}
                      </td>
                      <td className="border-r px-2 py-2" />
                    </Fragment>
                  )
                })}
                <td className="px-2 py-2 text-right text-xs tabular-nums">
                  <span className="block font-semibold">
                    {grand.allocated > 0 ? formatHours(grand.allocated) : "-"}
                  </span>
                  {grand.spent > 0 && (
                    <span className="text-muted-foreground block text-[10px]">
                      spent {formatHours(grand.spent)}
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Legend - the colours are the status, so they have to be readable. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {TASK_WORKFLOW_STATUSES.map((s) => (
          <span key={s} className={cn("font-medium", STATUS_TEXT[s])}>
            {TASK_STATUS_LABELS[s] ?? s}
          </span>
        ))}
      </div>

      {/* One line per column, in the order you use them. This was a single
          paragraph and nobody reads a paragraph to find out what a cell does. */}
      {!readOnly && (
        <ul className="text-muted-foreground marker:text-muted-foreground/40 list-disc space-y-1 pl-4 text-xs">
          <li>
            <Term>Plan</Term> click a cell and write one task per line, with the allocation inline:{" "}
            <Chip>Fix cart @2h</Chip> - also <Chip>@90m</Chip>, <Chip>@1h30m</Chip>, or a bare{" "}
            <Chip>@2</Chip> for hours.
          </li>
          <li>
            <Chip>Enter</Chip> saves the cell, <Chip>Shift</Chip>+<Chip>Enter</Chip> starts the next
            task, <Chip>Esc</Chip> cancels. Clicking away saves too.
          </li>
          <li>
            <Term>Status</Term> click a task&apos;s number to move it between phases. On Hold and
            Discarded ask for a reason first.
            {onOpenTask && " The same menu opens the task itself - comments, checklist and files."}
          </li>
          <li>
            <Term>Actual</Term> click a numbered row to note what really happened.
          </li>
          <li>
            <Term>Hrs</Term> the top number is the allocation, editable there too; the one under it
            is time spent - measured off the task clock, never typed.
          </li>
          <li>
            <Term>Resources</Term> attach the brief, the doc, the published page - one URL per line.
            Not time-limited, so you can add the live link whenever the work goes out.
          </li>
          <li>
            Removing a line asks before it deletes the task, and only the team manager can. You can
            edit a task you raised for 15 minutes after raising it.
          </li>
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingPlan}
        onOpenChange={(open) => {
          if (!open) setPendingPlan(null)
        }}
        title={pendingPlan?.deletes.length === 1 ? "Remove this task?" : "Remove these tasks?"}
        description={
          pendingPlan
            ? `${pendingPlan.deletes.map((t) => `"${t.title}"`).join(", ")} will be deleted from ${pendingPlan.projectName}, along with its hours, comments and history. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          const plan = pendingPlan
          setPendingPlan(null)
          if (plan) void runPlan(plan, plan.cellKey)
        }}
      />

      {/* On Hold / Discarded picked from a number's menu land here first: both
          phases require a written reason, and a hold also needs the date it is
          expected by. Same dialog the dropdown and the kanban drag use. */}
      <TaskStatusReasonDialog
        mode={pendingStatus?.mode ?? null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null)
        }}
        onConfirm={(payload: TaskStatusPayload) => {
          const p = pendingStatus
          setPendingStatus(null)
          if (p) void patchTask(p.task, { ...payload }, `${p.task.id}|status`, "Status updated")
        }}
      />
    </div>
  )
}

// ── Legend bits ──────────────────────────────────────────────────────────────

/** The column being described, so the eye can jump straight to its line. */
function Term({ children }: { children: ReactNode }) {
  return <strong className="text-foreground font-medium">{children} -</strong>
}

/** A literal you type: a key, or text that goes in a cell. */
function Chip({ children }: { children: ReactNode }) {
  return <code className="bg-muted rounded-[2px] px-1 py-0.5">{children}</code>
}

// ── Cells ────────────────────────────────────────────────────────────────────

/** The row number that ties Plan, Actual and Hrs together. */
function TaskNumber({ n, status }: { n: number; status?: string }) {
  return (
    <span
      className={cn(
        "w-4 shrink-0 text-right text-[11px] font-medium tabular-nums",
        status ? (STATUS_TEXT[status] ?? "text-foreground") : "text-muted-foreground/50",
      )}
    >
      {n}.
    </span>
  )
}

/**
 * The same number, but it opens the phase menu.
 *
 * The number already IS the status - it is printed in the status colour - so it
 * is the one per-line affordance that can carry the change without adding a
 * dropdown box to every row and without stealing the click that opens the
 * cell's text editor.
 */
function StatusNumber({
  n,
  task,
  disabled,
  onPick,
  onOpenTask,
}: {
  n: number
  task: SheetTask
  disabled: boolean
  onPick: (task: SheetTask, next: string) => void
  /** Given: the menu also opens the task's full record. */
  onOpenTask?: (task: SheetTask) => void
}) {
  // The workflow set, plus the current value up front if it is a legacy status
  // (IN_REVIEW / CANCELLED) so it still shows as the selected one.
  const options = useMemo(() => {
    const set = [...TASK_WORKFLOW_STATUSES] as string[]
    if (!set.includes(task.status)) set.unshift(task.status)
    return set
  }, [task.status])

  const label = TASK_STATUS_LABELS[task.status] ?? task.status
  // Nothing to move it TO, but the record behind the line is still worth
  // reading - so a locked line opens it directly instead of offering a menu of
  // one. Without this, a colleague's row would have no way into its comments.
  if (disabled) {
    if (!onOpenTask) return <TaskNumber n={n} status={task.status} />
    return (
      <button
        type="button"
        title={`${label} · click to open`}
        aria-label={`Open task ${n}: ${task.title}`}
        onClick={(e) => {
          e.stopPropagation()
          onOpenTask(task)
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "w-4 shrink-0 cursor-pointer rounded-[2px] text-right text-[11px] font-medium tabular-nums underline-offset-2 hover:underline",
          "focus-visible:ring-primary/60 outline-none focus-visible:ring-2",
          STATUS_TEXT[task.status] ?? "text-foreground",
        )}
      >
        {n}.
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={`${label} · click to change`}
          aria-label={`Status of task ${n}: ${label}`}
          // The cell behind this opens the plan editor on click; without this
          // every attempt to change a status would open the textarea instead.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "w-4 shrink-0 cursor-pointer rounded-[2px] text-right text-[11px] font-medium tabular-nums underline-offset-2 hover:underline",
            "focus-visible:ring-primary/60 outline-none focus-visible:ring-2",
            STATUS_TEXT[task.status] ?? "text-foreground",
          )}
        >
          {n}.
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {onOpenTask && (
          <>
            <DropdownMenuItem className="text-xs" onSelect={() => onOpenTask(task)}>
              Open task…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => onPick(task, s)}
            className={cn("text-xs", STATUS_TEXT[s] ?? "text-foreground")}
          >
            {TASK_STATUS_LABELS[s] ?? s}
            {s === task.status && <Check className="ml-auto h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CellBusy() {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5 px-2.5 py-2 text-[11px]">
      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
    </span>
  )
}

/**
 * The PLAN cell: reads as the day's numbered list, edits as plain text.
 *
 * Display and edit are separate states on purpose - that is how a spreadsheet
 * cell behaves, and it is the only way to number and status-colour each line
 * while still letting the whole cell be re-typed in one go.
 */
function PlanCell({
  tasks,
  busy,
  readOnly,
  onCommit,
  onPickStatus,
  canEdit,
  editHint,
  onOpenTask,
}: {
  tasks: SheetTask[]
  busy: boolean
  readOnly: boolean
  onCommit: (lines: PlanLine[]) => void
  onPickStatus: (task: SheetTask, next: string) => void
  canEdit: (task: SheetTask) => boolean
  editHint: (task: SheetTask) => string | undefined
  onOpenTask?: (task: SheetTask) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  // One editing session ends exactly once. Blur, Enter, Escape and a click
  // outside can all arrive for the same session - and often two of them do -
  // so every route goes through finish() and the first one wins.
  const settled = useRef(false)
  // Where the caret belongs after a renumber, applied before the browser paints
  // so it never visibly jumps to the end of the cell.
  const caret = useRef<number | null>(null)

  // The allocation round-trips through the text, so what you see in the cell is
  // exactly what the parse reads back - no hidden state to get out of step.
  const stored = tasks.map(planLineOf).join("\n")

  // fillParent: this textarea is the direct child of the <td>, so it can and
  // should take the whole cell - the editor should never be a small box sitting
  // inside a larger cell.
  useAutoGrow(ref, text, editing, true)
  useCommitOnOutsidePointer(ref, editing, () => finish(true))

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current === null) return
    el.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  function begin() {
    if (readOnly || busy) return
    settled.current = false
    // An empty cell opens on "1. " so the numbering is there from the first
    // keystroke rather than appearing once a second line exists.
    setText(numberLines(tasks.length > 0 ? tasks.map(planLineOf) : [""]))
    setEditing(true)
  }

  /** Renumber whatever was just typed and keep the caret where it was. */
  function apply(bare: string[], line: number, col: number) {
    setText(numberLines(bare))
    caret.current = caretFor(bare, line, col)
  }

  function handleChange(value: string, selection: number) {
    const { line, col } = locate(value, selection)
    const removed = value.split("\n")[line]?.match(NUMBERING)?.[0].length ?? 0
    apply(toBareLines(value), line, Math.max(0, col - removed))
  }

  /**
   * Backspace at the head of a line joins it to the one above. Left to the
   * browser that would merge the raw text and leave the stale "2. " sitting in
   * the middle of the joined line; doing it on the bare lines drops the
   * numbering with the break, which is what the keystroke means.
   */
  function handleBackspace(el: HTMLTextAreaElement): boolean {
    if (el.selectionStart !== el.selectionEnd) return false
    const value = el.value
    const { line, col } = locate(value, el.selectionStart)
    const prefix = value.split("\n")[line]?.match(NUMBERING)?.[0].length ?? 0
    if (line === 0 || col > prefix) return false

    const bare = toBareLines(value)
    const above = bare[line - 1] ?? ""
    const merged = [...bare.slice(0, line - 1), above + (bare[line] ?? ""), ...bare.slice(line + 1)]
    apply(merged, line - 1, above.length)
    return true
  }

  /** End the session: `save` false is Escape, everything else saves. */
  function finish(save: boolean) {
    if (settled.current) return
    settled.current = true
    setEditing(false)
    if (!save) return
    const lines = text
      .split("\n")
      .map(parsePlanLine)
      .filter((l) => l.title)
    // Compare in canonical form, so re-typing the same plan with stray spaces
    // or hand-written numbering is recognised as the no-op it is.
    if (lines.map(canonicalLine).join("\n") === stored) return
    onCommit(lines)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={text}
        rows={1}
        onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            finish(false)
            return
          }
          // Enter saves - the cell is done far more often than it needs another
          // line. Shift+Enter (or Ctrl/Cmd+Enter) is how you keep going.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            finish(true)
            return
          }
          if (e.key === "Backspace" && handleBackspace(e.currentTarget)) {
            e.preventDefault()
          }
        }}
        // The active-cell look: the outline is drawn INSIDE the box, so the
        // editor lines up exactly with the cell's grid lines instead of a ring
        // bleeding over its neighbours.
        className="outline-primary block h-full min-h-14 w-full resize-none overflow-hidden bg-transparent px-2.5 py-2 text-xs leading-relaxed outline-2 -outline-offset-2"
        placeholder="1. Fix cart @2h"
      />
    )
  }

  if (busy) return <CellBusy />

  return (
    <div
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      onClick={begin}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          begin()
        }
      }}
      className={cn(
        "min-h-14 px-2.5 py-2 text-xs leading-relaxed",
        !readOnly &&
          "hover:bg-muted/40 focus:ring-primary/60 cursor-text outline-none focus:ring-2",
      )}
    >
      {tasks.length === 0 && (
        <span className="text-muted-foreground/50 select-none">{readOnly ? "" : "+"}</span>
      )}
      {tasks.map((task, i) => (
        <span
          key={task.id}
          className="flex items-start gap-1.5 py-0.5"
          title={[TASK_STATUS_LABELS[task.status] ?? task.status, editHint(task)]
            .filter(Boolean)
            .join(" · ")}
        >
          <StatusNumber
            n={i + 1}
            task={task}
            // A rejected task must not be moved through the workflow - the same
            // gate every other view enforces.
            disabled={readOnly || busy || task.approvalStatus === "REJECTED"}
            onPick={onPickStatus}
            onOpenTask={onOpenTask}
          />
          <span
            className={cn(
              "min-w-0 flex-1 break-words",
              STATUS_TEXT[task.status] ?? "text-foreground",
              STATUS_CLOSED.has(task.status) && "line-through",
            )}
          >
            {task.title}
            {/* The wording is settled - re-typing this line will be refused, so
                say so here rather than after the attempt. */}
            {!readOnly && !canEdit(task) && (
              <Lock
                className="text-muted-foreground/50 ml-1 inline h-2.5 w-2.5 align-baseline"
                aria-label="Locked"
              />
            )}
          </span>
          {/* Dimmed until pointed at: one of these per line would otherwise be a
              column of icons competing with the plan itself. It stops its own
              click, so opening the log never opens the cell editor. */}
          <TaskHistoryDialog
            taskId={task.id}
            taskTitle={task.title}
            iconOnly
            className="size-4 shrink-0 opacity-30 transition-opacity hover:opacity-100 focus-visible:opacity-100"
          />
        </span>
      ))}
    </div>
  )
}

/**
 * The ACTUAL cell: what really happened, one note per planned task.
 *
 * Edited row by row rather than as one block of text. A note can itself run to
 * several lines, so there is no safe way to split a whole-cell edit back into
 * per-task notes - and unlike Plan, this column never adds or removes tasks.
 */
function ActualCell({
  tasks,
  busy,
  canEdit,
  onCommit,
}: {
  tasks: SheetTask[]
  busy: boolean
  canEdit: (task: SheetTask) => boolean
  onCommit: (task: SheetTask, text: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const ref = useRef<HTMLTextAreaElement>(null)
  const settled = useRef(false)

  const editingTask = tasks.find((t) => t.id === editingId) ?? null

  useAutoGrow(ref, text, !!editingId)
  useCommitOnOutsidePointer(ref, !!editingId, () => {
    if (editingTask) finish(editingTask, true)
  })

  useEffect(() => {
    if (!editingId) return
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editingId])

  function begin(task: SheetTask) {
    if (!canEdit(task) || busy) return
    settled.current = false
    setText(task.description ?? "")
    setEditingId(task.id)
  }

  function finish(task: SheetTask, save: boolean) {
    if (settled.current) return
    settled.current = true
    setEditingId(null)
    if (!save) return
    const next = text.trim()
    if (next === (task.description ?? "").trim()) return
    onCommit(task, next)
  }

  if (busy) return <CellBusy />

  return (
    <div className="min-h-14 px-2.5 py-2 text-xs leading-relaxed">
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">–</span>}
      {tasks.map((task, i) => {
        const editable = canEdit(task)
        return (
          <span key={task.id} className="flex items-start gap-1.5 py-0.5">
            <TaskNumber n={i + 1} status={task.status} />
            {editingId === task.id ? (
              <textarea
                ref={ref}
                value={text}
                rows={1}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => finish(task, true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    finish(task, false)
                    return
                  }
                  // Same chord as Plan, so the two editors do not need separate
                  // muscle memory: Enter saves, Shift+Enter breaks the line.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    finish(task, true)
                  }
                }}
                className="ring-primary min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-xs leading-relaxed ring-2 outline-none"
                placeholder="What actually happened…"
              />
            ) : (
              <span
                role={editable ? "button" : undefined}
                tabIndex={editable ? 0 : undefined}
                onClick={() => begin(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    begin(task)
                  }
                }}
                title={editable ? undefined : "Locked - only the team manager can change this now"}
                className={cn(
                  "min-w-0 flex-1 break-words whitespace-pre-wrap",
                  editable &&
                    "hover:bg-muted/40 focus:ring-primary/60 cursor-text rounded-[2px] outline-none focus:ring-2",
                  // The note carries the task's status too, so a completed line
                  // reads as completed all the way across the sheet.
                  task.description
                    ? (STATUS_TEXT[task.status] ?? "text-foreground")
                    : "text-muted-foreground/40",
                )}
              >
                {task.description || (editable ? "add…" : "–")}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/**
 * The RESOURCES cell: where each task's work actually lives.
 *
 * Stored as `links` on the task, because that is what they are - URLs. The
 * column is called Resources because that is what they MEAN to the person
 * reading the sheet, and because `ProjectResource` (uploaded files) already
 * owns the word in the data model.
 *
 * Not governed by the 15-minute edit window, unlike the rest of a task's
 * details. Attaching the published URL is something you do WHEN the blog goes
 * live, which is hours or days after the task was raised - locking it on the
 * same clock as the title would make the column useless for its main purpose.
 */
function ResourcesCell({
  tasks,
  busy,
  readOnly,
  onCommit,
}: {
  tasks: SheetTask[]
  busy: boolean
  readOnly: boolean
  onCommit: (task: SheetTask, links: string[]) => void
}) {
  if (busy) return <CellBusy />

  return (
    <div className="min-h-14 px-2 py-2 text-xs leading-relaxed">
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">–</span>}
      {tasks.map((task, i) => (
        <span key={task.id} className="flex items-start gap-1.5 py-0.5">
          <TaskNumber n={i + 1} status={task.status} />
          <TaskResources
            links={task.links ?? []}
            canEdit={!readOnly}
            onCommit={(links) => onCommit(task, links)}
            className="flex-1"
          />
        </span>
      ))}
    </div>
  )
}

/**
 * The HRS cell: allocated over spent, per task.
 *
 * Allocated is the plan and is editable here as well as inline in Plan ("@2h").
 * Spent is measured - the clock runs off the task's own status changes - so it
 * is never typed; a number typed there would be a claim rather than a record.
 */
function HoursCell({
  tasks,
  busy,
  canEdit,
  onCommit,
}: {
  tasks: SheetTask[]
  busy: boolean
  canEdit: (task: SheetTask) => boolean
  onCommit: (task: SheetTask, hours: number | null) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [text, setText] = useState("")
  const ref = useRef<HTMLInputElement>(null)
  const settled = useRef(false)

  const editingTask = tasks.find((t) => t.id === editingId) ?? null

  useCommitOnOutsidePointer(ref, !!editingId, () => {
    if (editingTask) finish(editingTask, true)
  })

  useEffect(() => {
    if (!editingId) return
    ref.current?.focus()
    ref.current?.select()
  }, [editingId])

  function begin(task: SheetTask) {
    if (!canEdit(task) || busy) return
    settled.current = false
    setText(task.estimatedHours ? formatToken(task.estimatedHours) : "")
    setEditingId(task.id)
  }

  function finish(task: SheetTask, save: boolean) {
    if (settled.current) return
    settled.current = true
    setEditingId(null)
    if (!save) return
    const raw = text.trim()
    const hours = raw ? parseDuration(raw) : null
    if (raw && hours === null) {
      toast.error(`"${raw}" is not a duration - try 2h, 90m or 1h30m`)
      return
    }
    if ((hours ?? null) === (task.estimatedHours ?? null)) return
    onCommit(task, hours)
  }

  const allocated = tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const spent = tasks.reduce((s, t) => s + spentHours(t), 0)

  if (busy) return <CellBusy />

  return (
    <div className="min-h-14 px-2 py-2 text-right text-xs leading-relaxed">
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">–</span>}
      {tasks.map((task, i) => {
        const est = task.estimatedHours ?? 0
        const used = spentHours(task)
        const over = est > 0 && used > est
        const editable = canEdit(task)
        return (
          <span
            key={task.id}
            className="flex items-start gap-1.5 py-0.5"
            title={
              est > 0
                ? `Allocated ${formatHours(est)}, spent ${formatHours(used)}`
                : `No allocation, spent ${formatHours(used)}`
            }
          >
            <TaskNumber n={i + 1} status={task.status} />
            <span className="min-w-0 flex-1 text-right tabular-nums">
              {editingId === task.id ? (
                <input
                  ref={ref}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={() => finish(task, true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault()
                      finish(task, false)
                      return
                    }
                    if (e.key === "Enter") {
                      e.preventDefault()
                      finish(task, true)
                    }
                  }}
                  placeholder="2h"
                  aria-label="Allocated hours"
                  className="ring-primary w-full bg-transparent text-right text-xs tabular-nums ring-2 outline-none"
                />
              ) : (
                <span
                  role={editable ? "button" : undefined}
                  tabIndex={editable ? 0 : undefined}
                  onClick={() => begin(task)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      begin(task)
                    }
                  }}
                  className={cn(
                    "block rounded-[2px]",
                    editable && "hover:bg-muted/40 focus:ring-primary/60 outline-none focus:ring-2",
                    est === 0 && "text-muted-foreground/40",
                  )}
                >
                  {est > 0 ? formatHours(est) : editable ? "set" : "–"}
                </span>
              )}
              <span
                className={cn(
                  "block text-[10px]",
                  over
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground/60",
                  task.inProgressSince && "text-blue-600 dark:text-blue-400",
                )}
              >
                {used > 0 ? formatHours(used) : "0m"}
              </span>
            </span>
          </span>
        )
      })}
      {tasks.length > 1 && (allocated > 0 || spent > 0) && (
        <span className="mt-1 block border-t pt-1 tabular-nums">
          <span className="block text-[11px] font-semibold">
            {allocated > 0 ? formatHours(allocated) : "–"}
          </span>
          <span className="text-muted-foreground block text-[10px]">
            {spent > 0 ? formatHours(spent) : "0m"}
          </span>
        </span>
      )}
    </div>
  )
}
