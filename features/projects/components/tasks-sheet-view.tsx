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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { sortProjectTeams } from "@/features/projects/lib/project-teams"
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
// The module, not the leave barrel (which re-exports every leave component).
import { useAwayDays, useTeamAwayDays, type AwayDay } from "@/features/leave/hooks/use-away-days"
import { followUpConflictFrom } from "@/features/projects/lib/follow-up-conflict"
import { afterTaskPatch } from "@/features/projects/lib/after-task-patch"
import { useFollowUpConflictStore } from "@/stores/follow-up-conflict-store"
import type { ProjectTeam } from "@/features/projects/hooks/use-projects"

// The weekly allocation sheet: per day, PLAN / ACTUAL / HRS / RESOURCES columns. Numbered lines tie the
// columns together; rows are clients (My Tasks) or people (a project's Tasks tab) - see SheetAxis.

export interface SheetTask {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  estimatedHours: number | null
  loggedHours: number
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
  /** managerId is the authority on adhoc work; the name labels rows for people who left the team. */
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

/** The project (or the Adhoc row) on the client axis; the assignee (or the Unassigned row) on the person axis. */
function rowIdOf(task: SheetTask, by: SheetAxis["by"]): string {
  return by === "client"
    ? (task.project?.id ?? ADHOC_ROW_ID)
    : (task.assignee?.id ?? UNASSIGNED_ROW_ID)
}

const UNASSIGNED_ROW_ID = "__unassigned__"

/** Frozen-pane edge on the pinned column, so the sheet reads as scrolling under it. */
const STICKY_EDGE = "sticky left-0 border-r-2 shadow-[4px_0_6px_-4px_rgb(0_0_0/0.45)]"

const STATUS_TEXT: Record<string, string> = {
  TODO: "text-foreground",
  IN_PROGRESS: "text-blue-600 dark:text-blue-400",
  IN_REVIEW: "text-amber-600 dark:text-amber-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  CANCELLED: "text-muted-foreground",
  ON_HOLD: "text-amber-600 dark:text-amber-400",
  DISCARDED: "text-red-600 dark:text-red-400",
}

const STATUS_CLOSED = new Set(["DONE", "DISCARDED", "CANCELLED"])

/** Resolves the manager as the API does (the team's for project work, the line manager for adhoc). */
function subjectOf(task: SheetTask) {
  return {
    creatorId: task.creatorId,
    createdAt: task.createdAt,
    // Null project = adhoc; must be the real value, never a fallback.
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

export function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  // getDay() is Sunday-first; shift so Monday is 0 and Sunday closes the week.
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Banked time plus the whole running stretch, undivided - matching what settleRunningTasks banks. */
function spentHours(task: SheetTask): number {
  const live = task.inProgressSince
    ? Math.max(0, Date.now() - new Date(task.inProgressSince).getTime()) / 3_600_000
    : 0
  return (task.loggedHours ?? 0) + live
}

const DURATION =
  /^([0-9]*\.?[0-9]+)\s*(h|hr|hrs|m|min|mins)?(?:\s*([0-9]{1,2})\s*(?:m|min|mins))?$/i

/** "2h", "2", "90m", "1h30m", "1.5h" -> decimal hours; a bare number is hours. Null if not a duration. */
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

/** A leading "1. " / "12) "; the lookahead keeps "1.5h review" and "2026 audit plan" intact. */
const NUMBERING = /^\s*\d{1,3}[.)](?=$|\s)\s*/

/** So typing "1. Fix cart" as in Excel doesn't store that literal title. */
function stripNumbering(line: string): string {
  return line.replace(NUMBERING, "").trim()
}

// Numbering is part of the editor text (a gutter would misalign on wrapped lines), renumbered per keystroke.

function toBareLines(value: string): string[] {
  return value.split("\n").map((l) => l.replace(NUMBERING, ""))
}

function numberLines(bare: string[]): string {
  return bare.map((l, i) => `${i + 1}. ${l}`).join("\n")
}

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

function caretFor(bare: string[], line: number, col: number): number {
  let n = 0
  for (let i = 0; i < line; i++) n += `${i + 1}. `.length + bare[i]!.length + 1
  return n + `${line + 1}. `.length + Math.min(col, bare[line]?.length ?? 0)
}

interface PlanLine {
  title: string
  hours: number | null
}

const AT_SUFFIX = /\s+@\s*(\S[^@]*)$/

/** "Fix cart @2h" -> title + allocation; a trailing "@vendor" that isn't a duration stays in the title. */
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

function canonicalLine(line: PlanLine): string {
  return line.hours ? `${line.title} @${formatToken(line.hours)}` : line.title
}

function planLineOf(task: SheetTask): string {
  return canonicalLine({ title: task.title, hours: task.estimatedHours ?? null })
}

interface TaskUpdate {
  task: SheetTask
  title?: string
  estimatedHours?: number | null
}

/** Titles are matched to existing tasks first, so reordering or deleting a line doesn't relabel other work. */
interface CellPlan {
  projectId: string
  projectName: string
  assigneeId: string
  rowName: string
  cellKey: string
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

  // Pass 1: a line that still reads exactly like a task IS that task, so reordering is a no-op.
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
  // Pass 2: leftovers pair up in order, so an edited line keeps its task (status, time, history).
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

/** Re-renders every 30s while `isLive(lastTick)` holds (under the 1-minute display unit). */
function useTick(isLive: (now: number) => boolean, everyMs = 30_000): number {
  const [tickedAt, setTickedAt] = useState(() => Date.now())
  const active = isLive(tickedAt)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTickedAt(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
  // Returned so time-dependent memos can list it as a dependency.
  return tickedAt
}

/** Sizes to the larger of content and cell, so the editor always IS the cell and never scrolls. */
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
    // Collapse first, so the parent measurement below is the row's real height.
    el.style.height = "auto"
    // +2 covers the outline, so the last line isn't clipped.
    const needed = el.scrollHeight + 2
    const cell = fillParent && el.parentElement ? el.parentElement.clientHeight : 0
    el.style.height = `${Math.max(needed, cell)}px`
  }, [ref, value, active, fillParent])
}

export interface SheetPerson {
  id: string
  name: string
  caption?: string
  /** May the viewer add NEW work to this row? Mirrors the create endpoint: own row, a managed team's, or admin. */
  canPlan?: boolean
}

/** client: one person's week across accounts (My Tasks); person: one account's week across people (Tasks tab). */
export type SheetAxis =
  | {
      by: "client"
      projects: SheetProject[]
      assigneeId: string
      /** Show the Adhoc row - hidden when the filter has narrowed to one client. */
      showAdhoc?: boolean
    }
  | {
      by: "person"
      project: SheetProject
      people: SheetPerson[]
    }

interface Props {
  /** Already filtered by project/status. Not filtered by date - the grid slices. */
  tasks: SheetTask[]
  axis: SheetAxis
  currentUserId: string
  /** Project admin (PROJECT_WRITE): edits and deletes without restriction. */
  isAdmin?: boolean
  readOnly?: boolean
  /** Opens the task's full record; offered from the line's status menu. */
  onOpenTask?: (task: SheetTask) => void
}

interface SheetRow {
  id: string
  name: string
  caption: string
  projectId: string
  projectName: string
  assigneeId: string
  /** Whose leave explains a quiet cell; empty on client rows (the header says it once). */
  awayOf: string
  /** A bucket rather than a real row: adhoc work, or work with no owner. */
  muted: boolean
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
  const [helpOpen, setHelpOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<{
    task: SheetTask
    mode: "ON_HOLD" | "DISCARDED"
  } | null>(null)

  const thisMonday = toKey(mondayOf(new Date()))
  const todayKey = toKey(new Date())

  // Tick while a clock runs or an edit window is open, so lines lock right when their 15 minutes end.
  const tick = useTick((now) =>
    tasks.some(
      (t) => t.inProgressSince || isWithinEditWindow(t.createdAt, now, TASK_EDIT_WINDOW_MS),
    ),
  )

  const actor = useMemo(() => ({ userId: currentUserId, isAdmin }), [currentUserId, isAdmin])
  const mayEdit = (task: SheetTask) => !readOnly && canEditTaskDetails(subjectOf(task), actor)
  const mayDelete = (task: SheetTask) => !readOnly && canDeleteTask(subjectOf(task), actor)

  function editHint(task: SheetTask): string | undefined {
    if (readOnly) return undefined
    if (!mayEdit(task)) return taskEditLockReason(subjectOf(task), actor) ?? undefined
    if (task.creatorId !== currentUserId) return undefined
    // Your own adhoc work never expires.
    if (!task.project && task.assignee?.id === currentUserId) return "Yours to edit"
    const left = taskEditWindowLeft(subjectOf(task))
    return left ? `Yours to edit - ${left}` : undefined
  }

  // Mon-Fri, plus a weekend day only when it has work.
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

  /** Also adds rows with work this week that are missing from the list; Adhoc / Unassigned go last. */
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
        // No team to file new work under, so the row can't be planned into.
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
        // Nobody to raise it on; giving the work an owner happens on the task.
        canPlan: false,
      },
    ]
  }, [axis, tasks, weekKeys])

  // Leave marks: one person's sheet marks the column headers; a team's marks each cell.
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

  /** Header marks: the person's own week, or for a team only public holidays. */
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
    // The last rendered column, not start+N: a lone Sunday task doesn't add a Saturday.
    const end = fromKey(days[days.length - 1]?.key ?? weekStart)
    const fmt = (d: Date, withYear: boolean) =>
      d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
      })
    return `${fmt(start, false)} - ${fmt(end, true)}`
  }, [weekStart, days])

  /** Assignee's team: one the caller manages (no approval queue), else first in catalogue order. */
  async function resolveTeamId(projectId: string, assigneeId: string): Promise<string | null> {
    const res = await qc.fetchQuery({
      queryKey: ["project-teams", projectId],
      queryFn: () => apiFetch<{ data: ProjectTeam[] }>(`/api/projects/${projectId}/teams`),
      staleTime: 60_000,
    })
    const teams = res?.data ?? []
    const withAssignee = sortProjectTeams(
      teams.filter((t) => t.members.some((m) => m.employeeId === assigneeId)),
    )
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
        // Adhoc work has no project or team, so it goes to the plain task endpoint.
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
      // Always refetch, so a failed cell snaps back to what's stored.
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

    // Drop lines this person may not edit before sending (and say which), rather than half-apply via 403s.
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
      // Nothing was sent, but the cell text differs from what's stored - pull it back.
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
      // Same follow-up as every completion path: shared clock, toast and output prompt.
      afterTaskPatch(await send(body), { successMessage: label })
    } catch (e) {
      // A hold follow-up conflict is a question for the user - see follow-up-conflict.ts.
      const conflict = followUpConflictFrom(e)
      if (conflict) {
        askFollowUpConflict({
          ...conflict,
          keep: async () => {
            afterTaskPatch(await send({ ...body, keepFollowUp: true }), {
              successMessage: label,
            })
            await qc.invalidateQueries({ queryKey: ["my-tasks"] })
          },
        })
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save")
      }
    } finally {
      setBusy(cellKey, false)
      await qc.invalidateQueries({ queryKey: ["my-tasks"] })
      if (task.project) qc.invalidateQueries({ queryKey: ["project-all-tasks", task.project.id] })
    }
  }

  /** On Hold / Discarded need the reason dialog; saved under an unrendered key so the cell never shows "Saving…". */
  function pickStatus(task: SheetTask, next: string) {
    if (next === task.status) return
    if (next === "ON_HOLD" || next === "DISCARDED") {
      setPendingStatus({ task, mode: next })
      return
    }
    void patchTask(task, { status: next }, `${task.id}|status`, "Status updated")
  }

  // Per-day footer totals; `tick` is a dependency because running clocks change spent hours.
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-semibold">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous week"
            onClick={() => setWeekStart(toKey(addDays(fromKey(weekStart), -7)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            disabled={weekStart === thisMonday}
            onClick={() => setWeekStart(thisMonday)}
          >
            This week
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next week"
            onClick={() => setWeekStart(toKey(addDays(fromKey(weekStart), 7)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-muted-foreground rounded-sm border border-dashed p-8 text-center text-sm">
          {axis.by === "person"
            ? "Nobody is on this project yet - add a team first."
            : "No projects to plan against."}
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded-sm border">
          <p className="text-muted-foreground border-b px-3 py-1.5 text-[11px] sm:hidden">
            Swipe sideways to see the rest of the week →
          </p>
          {/* border-separate: a collapsed border belongs to the table, so the sticky column's edge would scroll away. */}
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/60">
                {/* Solid: cells scroll under this column. */}
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
                        away?.status !== "half-day" && away && "bg-muted/60",
                      )}
                    >
                      {c.label}
                      <span className="text-muted-foreground ml-1.5 font-normal normal-case">
                        {c.sub}
                      </span>
                      {/* Icon + words, never the leave type - that's nobody's business on a task board. */}
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
                      className={cn(
                        "z-10 border-b px-3 py-2 text-left align-top",
                        STICKY_EDGE,
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
                      // This person's absence; a whole-sheet absence is already in the header.
                      const away = awayByDay.has(c.key)
                        ? undefined
                        : awayByRow.get(row.awayOf)?.get(c.key)
                      // One bg class per cell: two bg utilities would win by stylesheet order.
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
                              // Only blocks new plans; existing lines follow their own task rules.
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
                            {rowAllocated > 0 ? formatHours(rowAllocated) : "-"}
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {!readOnly && (
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="How this sheet works"
            title="How this sheet works"
            className="text-muted-foreground hover:text-foreground hover:border-foreground/40 border-border flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold transition-colors"
          >
            ?
          </button>
        )}
        {TASK_WORKFLOW_STATUSES.map((s) => (
          <span key={s} className={cn("font-medium", STATUS_TEXT[s])}>
            {TASK_STATUS_LABELS[s] ?? s}
          </span>
        ))}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How this sheet works</DialogTitle>
            <DialogDescription>One line per column, in the order you use them.</DialogDescription>
          </DialogHeader>
          <ul className="text-muted-foreground marker:text-muted-foreground/40 list-disc space-y-2 pl-4 text-xs">
            <li>
              <Term>Plan</Term> click a cell and write one task per line, with the allocation
              inline: <Chip>Fix cart @2h</Chip> - also <Chip>@90m</Chip>, <Chip>@1h30m</Chip>, or a
              bare <Chip>@2</Chip> for hours.
            </li>
            <li>
              <Chip>Enter</Chip> saves the cell, <Chip>Shift</Chip>+<Chip>Enter</Chip> starts the
              next task, <Chip>Esc</Chip> cancels. Clicking away saves too.
            </li>
            <li>
              <Term>Status</Term> click a task&apos;s number to move it between phases. On Hold and
              Discarded ask for a reason first.
              {onOpenTask &&
                " The same menu opens the task itself - comments, checklist and files."}
            </li>
            <li>
              <Term>Actual</Term> click a numbered row to note what really happened.
            </li>
            <li>
              <Term>Hrs</Term> the top number is the allocation, editable there too; the one under
              it is time spent - measured off the task clock, never typed.
            </li>
            <li>
              <Term>Resources</Term> attach the brief, the doc, the published page - one URL per
              line. Not time-limited, so you can add the live link whenever the work goes out.
            </li>
            <li>
              Removing a line asks before it deletes the task, and only the team manager can. You
              can edit a task you raised for 15 minutes after raising it.
            </li>
          </ul>
        </DialogContent>
      </Dialog>

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

function Term({ children }: { children: ReactNode }) {
  return <strong className="text-foreground font-medium">{children} -</strong>
}

function Chip({ children }: { children: ReactNode }) {
  return <code className="bg-muted rounded-sm px-1 py-0.5">{children}</code>
}

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

/** The status-coloured number doubles as the phase menu, without stealing the cell editor's click. */
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
  onOpenTask?: (task: SheetTask) => void
}) {
  // Keep a legacy current status (IN_REVIEW / CANCELLED) so it still shows as selected.
  const options = useMemo(() => {
    const set = [...TASK_WORKFLOW_STATUSES] as string[]
    if (!set.includes(task.status)) set.unshift(task.status)
    return set
  }, [task.status])

  const label = TASK_STATUS_LABELS[task.status] ?? task.status
  // Locked: open the record directly instead of a one-item menu.
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
          "w-4 shrink-0 cursor-pointer rounded-sm text-right text-[11px] font-medium tabular-nums underline-offset-2 hover:underline",
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
          // Otherwise the click would also open the plan editor.
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "w-4 shrink-0 cursor-pointer rounded-sm text-right text-[11px] font-medium tabular-nums underline-offset-2 hover:underline",
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

/** Reads as a numbered, status-coloured list; edits as plain text, like a spreadsheet cell. */
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
  // Several routes can end one session; finish() runs once and the first wins.
  const settled = useRef(false)
  // Caret position after a renumber, applied before paint so it doesn't jump.
  const caret = useRef<number | null>(null)

  const stored = tasks.map(planLineOf).join("\n")

  // fillParent: this textarea is the <td>'s direct child, so it takes the whole cell.
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
    // An empty cell opens on "1. ".
    setText(numberLines(tasks.length > 0 ? tasks.map(planLineOf) : [""]))
    setEditing(true)
  }

  function apply(bare: string[], line: number, col: number) {
    setText(numberLines(bare))
    caret.current = caretFor(bare, line, col)
  }

  function handleChange(value: string, selection: number) {
    const { line, col } = locate(value, selection)
    const removed = value.split("\n")[line]?.match(NUMBERING)?.[0].length ?? 0
    apply(toBareLines(value), line, Math.max(0, col - removed))
  }

  /** Backspace at a line's start joins it to the line above, dropping the numbering with the break. */
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
    // Canonical compare, so stray spaces or hand-typed numbering are a no-op.
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
          // Enter saves; Shift+Enter (or Ctrl/Cmd+Enter) adds a line.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            finish(true)
            return
          }
          if (e.key === "Backspace" && handleBackspace(e.currentTarget)) {
            e.preventDefault()
          }
        }}
        // Outline drawn inside, so the editor lines up with the cell's grid lines.
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
            // A rejected task can't move through the workflow (the same gate as every view).
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
            {!readOnly && !canEdit(task) && (
              <Lock
                className="text-muted-foreground/50 ml-1 inline h-2.5 w-2.5 align-baseline"
                aria-label="Locked"
              />
            )}
          </span>
          {/* Dimmed until hovered; stops its own click so the cell editor doesn't open. */}
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

/** One note per planned task, edited row by row (a multi-line note can't be split back safely). */
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
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">-</span>}
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
                  // Same keys as Plan: Enter saves, Shift+Enter breaks the line.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    finish(task, true)
                  }
                }}
                className="ring-primary min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-xs leading-relaxed ring-2 outline-none"
                placeholder="What actually happened…"
                aria-label="What actually happened"
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
                    "hover:bg-muted/40 focus:ring-primary/60 cursor-text rounded-sm outline-none focus:ring-2",
                  task.description
                    ? (STATUS_TEXT[task.status] ?? "text-foreground")
                    : "text-muted-foreground/40",
                )}
              >
                {task.description || (editable ? "add…" : "-")}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}

/** Stored as the task's `links`. Exempt from the 15-minute edit window: URLs get added when the work goes live. */
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
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">-</span>}
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

/** Allocated (editable here or as "@2h" in Plan) over spent (measured from status changes, never typed). */
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
      {tasks.length === 0 && <span className="text-muted-foreground/40 select-none">-</span>}
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
                    "block rounded-sm",
                    editable && "hover:bg-muted/40 focus:ring-primary/60 outline-none focus:ring-2",
                    est === 0 && "text-muted-foreground/40",
                  )}
                >
                  {est > 0 ? formatHours(est) : editable ? "set" : "-"}
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
            {allocated > 0 ? formatHours(allocated) : "-"}
          </span>
          <span className="text-muted-foreground block text-[10px]">
            {spent > 0 ? formatHours(spent) : "0m"}
          </span>
        </span>
      )}
    </div>
  )
}
