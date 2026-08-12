"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { AlertTriangle, ChevronDown, ChevronRight, Inbox, Lock, X } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { StatStrip } from "@/components/shared/stat-strip"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  PERMISSIONS,
  TASK_STATUS_LABELS,
  TASK_WORKFLOW_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/lib/constants"
import { usePermissions } from "@/features/admin"
import {
  ADHOC_LABEL,
  ADHOC_ROW_ID,
  canEditTaskDetails,
  resolveTaskManagerId,
  taskEditLockReason,
} from "@/features/projects/lib/task-permissions"
import { TaskResources } from "@/features/projects/components/task-resources"
import { cn } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { TaskStatusSelect } from "@/features/projects/components/task-status-select"
import { TaskTime } from "@/features/projects/components/task-time"
import { TaskHistoryDialog } from "@/features/projects/components/task-history-dialog"
import { formatHours } from "@/features/projects/lib/format-hours"
import { projectHref } from "@/features/projects/lib/project-href"
import { followUpConflictFrom } from "@/features/projects/lib/follow-up-conflict"
import { useFollowUpConflictStore } from "@/stores/follow-up-conflict-store"
import { apiFetch } from "@/lib/api-fetch"
import { BlockedBadge } from "@/features/projects/components/blocked-badge"
import { useProjects } from "@/features/projects/hooks/use-projects"
import { DateField } from "@/components/shared/date-field"
import { useSession } from "next-auth/react"
import { TaskCreateDialog } from "@/features/projects/components/task-create-dialog"
import { TasksSheetView } from "@/features/projects/components/tasks-sheet-view"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

interface MyTask {
  id: string
  title: string
  /** Doubles as the "actual" note in the sheet view: what really happened. */
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  loggedHours: number
  estimatedHours: number | null
  /** The sheet's Resources column: brief, doc, published page. */
  links: string[]
  /** Non-null while the task sits In Progress and its clock is running. */
  inProgressSince: string | null
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
  rejectionReason: string | null
  /** Who raised it, and when - together these decide the 15-minute edit window. */
  creatorId: string
  createdAt: string
  /** Null for ADHOC work - meetings, interviews, anything with no client. */
  project: { id: string; name: string; code: string; slug: string | null } | null
  team?: { id: string; name: string; managerId: string | null } | null
  /** Set while this task waits on a requirement; drives the Blocked badge. */
  requirement?: { id: string; title: string; status: string } | null
  /** managerId is the authority on adhoc work, which has no team manager. */
  assignee?: { id: string; firstName: string; lastName: string; managerId?: string | null } | null
}

/** "me" | "user:<id>" - see GET /api/tasks, which also still accepts "all". */
type TaskScope = string

/**
 * Only the people list is read here. The response also carries the teams the
 * caller manages; this page has no team view, so it ignores them.
 */
interface ScopeMeta {
  /** isReport = a direct subordinate. False = on a team you manage, nothing more. */
  people: { id: string; name: string; isReport: boolean }[]
}

/** "Me" - kept distinct from a user id so the query key stays the plain one. */
const MYSELF = "me"

const PERSON_KEY = "my-tasks:person"

/**
 * Whose sheet you were last looking at, remembered across reloads.
 *
 * Read in an effect rather than a lazy initialiser on purpose: localStorage does
 * not exist while this renders on the server, and seeding state from it on the
 * client only would make the first client render disagree with the server's and
 * trip a hydration mismatch. One extra render is the cost of not doing that.
 */
function usePersistedPerson(): [string, (v: string) => void] {
  const [person, setPersonState] = useState<string>(MYSELF)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PERSON_KEY)
      if (stored) setPersonState(stored)
    } catch {}
  }, [])

  const setPerson = useCallback((v: string) => {
    setPersonState(v)
    try {
      // Yourself is the default, so it is stored as the ABSENCE of a value -
      // nothing to clean up later, and no stale id outliving a reporting change.
      if (v === MYSELF) localStorage.removeItem(PERSON_KEY)
      else localStorage.setItem(PERSON_KEY, v)
    } catch {}
  }, [])

  return [person, setPerson]
}

async function fetchMyTasks(scope: TaskScope): Promise<{ data: MyTask[]; meta?: ScopeMeta }> {
  const res = await fetch(`/api/tasks?mine=true&scope=${encodeURIComponent(scope)}`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

// Goes through apiFetch rather than a bare fetch so the server's error CODE and
// DETAILS survive - the follow-up question below is unanswerable without them.
async function updateTask(id: string, body: Record<string, unknown>) {
  return apiFetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const NO_DATE = "none"

/** Local calendar day of an ISO date, e.g. "2026-08-03". */
function dayKey(iso: string | null): string {
  if (!iso) return NO_DATE
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Where a task's client goes. Adhoc work has no project, so there is nothing to
 * link to - it says "ADHOC" in muted text rather than rendering a dead link or,
 * worse, an empty gap where every other row names an account.
 */
function ProjectLink({ task, className }: { task: MyTask; className?: string }) {
  if (!task.project) {
    return <span className={cn("text-muted-foreground", className)}>{ADHOC_LABEL}</span>
  }
  return (
    <Link href={projectHref(task.project)} className={cn("hover:underline", className)}>
      {task.project.name}
    </Link>
  )
}

/**
 * The shape the edit rules read. Same resolution the API uses - the team's
 * manager for project work, the assignee's line manager for adhoc - so the card
 * shows the same lock the server would enforce.
 */
function taskSubject(task: MyTask) {
  return {
    creatorId: task.creatorId,
    createdAt: task.createdAt,
    teamManagerId: resolveTaskManagerId({
      teamId: task.team?.id ?? null,
      teamManagerId: task.team?.managerId,
      assigneeManagerId: task.assignee?.managerId,
    }),
  }
}

/** "Today · Mon, 3 Aug", "Tomorrow · …", or just the date. */
function dayLabel(key: string): string {
  if (key === NO_DATE) return "No due date"
  const [y, m, d] = key.split("-").map(Number)
  const date = new Date(y!, m! - 1, d!)
  const pretty = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return `Today · ${pretty}`
  if (diffDays === 1) return `Tomorrow · ${pretty}`
  if (diffDays === -1) return `Yesterday · ${pretty}`
  return pretty
}

export default function MyTasksPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [projectFilter, setProjectFilter] = useState("all")
  /** "" means every date; otherwise a "yyyy-MM-dd" due date. */
  const [dateFilter, setDateFilter] = useState("")
  // Anyone who last used the table or the board still has it in localStorage.
  // Both are gone, so fold them back to cards rather than render a toggle with
  // nothing selected over a list that silently fell through to the default.
  const [storedView, setViewMode] = useViewMode("my-tasks")
  const viewMode = storedView === "sheet" ? "sheet" : "card"
  const qc = useQueryClient()
  const askFollowUpConflict = useFollowUpConflictStore((s) => s.ask)

  const { data: session } = useSession()
  const { can } = usePermissions()
  const myName = session?.user
    ? `${session.user.firstName} ${session.user.lastName}`.trim()
    : "My tasks"

  // Every project this person is on (owned or staffed) - the same list the
  // projects board shows them, so the filter can never offer a project they
  // cannot open.
  const { data: projectsData } = useProjects()
  const myProjects = useMemo(() => projectsData?.data ?? [], [projectsData])

  // ── Whose tasks ────────────────────────────────────────────────────────────
  // One dropdown, one question: whose sheet am I looking at. You or one of your
  // subordinates - never a team, never a merged "everyone" list, because the
  // sheet reads as ONE person's week and a mixed list is not that.
  const [person, setPerson] = usePersistedPerson()
  const isMine = person === MYSELF

  const scope: TaskScope = isMine ? MYSELF : `user:${person}`

  // "me" keeps the bare ["my-tasks"] key: MyProgress shares that entry and the
  // drag handler patches it in place. Every other scope is a different result
  // set, so it gets its own entry rather than overwriting theirs.
  const queryKey = useMemo(() => (isMine ? ["my-tasks"] : ["my-tasks", scope]), [isMine, scope])
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchMyTasks(scope) })

  // The pickers are built from what the server says this person manages, so they
  // can never offer a team or a colleague they have no business seeing. Held
  // across refetches: switching scope briefly clears `data`, and rebuilding the
  // list from an empty response would collapse the menu mid-selection.
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta>({ people: [] })
  // Distinct from "the list is empty": before the first response arrives nobody
  // is selectable, and the guard below must not read that as "your selection is
  // invalid" - that is what reset a restored person straight back to you.
  const [metaLoaded, setMetaLoaded] = useState(false)
  useEffect(() => {
    if (!data?.meta) return
    setScopeMeta(data.meta)
    setMetaLoaded(true)
  }, [data])
  /**
   * Your SUBORDINATES - direct reports only.
   *
   * Managing a team does not make everyone on it your report, and the old flat
   * list mixed the two so you could not tell which was which. Only people who
   * actually report to you are offered here.
   */
  const selectablePeople = useMemo(
    () => scopeMeta.people.filter((p) => p.isReport).sort((a, b) => a.name.localeCompare(b.name)),
    [scopeMeta.people],
  )
  const managesSomething = selectablePeople.length > 0

  // A report who moves away stops being selectable; falling back to yourself
  // beats a picker displaying a value that is no longer in its own list. Only
  // once the list has actually loaded, or a restored selection is thrown away
  // before the server has had a chance to confirm it.
  useEffect(() => {
    if (!metaLoaded || person === MYSELF) return
    if (!selectablePeople.some((p) => p.id === person)) setPerson(MYSELF)
  }, [metaLoaded, selectablePeople, person, setPerson])

  /** What the header should call the current selection. Real names, never "me". */
  const scopeLabel = useMemo(
    () =>
      person === MYSELF
        ? myName
        : (scopeMeta.people.find((p) => p.id === person)?.name ?? "Teammate"),
    [person, scopeMeta.people, myName],
  )

  const [createOpen, setCreateOpen] = useState(false)
  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => updateTask(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      toast.success("Task updated")
    },
    onError: (error: Error, variables) => {
      // A hold follow-up whose original is already underway: ask rather than
      // fail, and re-send confirmed if they choose to keep it.
      const conflict = followUpConflictFrom(error)
      if (conflict) {
        const { id, ...body } = variables
        askFollowUpConflict({
          ...conflict,
          keep: async () => {
            await updateTask(id, { ...body, keepFollowUp: true })
            qc.invalidateQueries({ queryKey: ["my-tasks"] })
            toast.success("Task updated")
          },
        })
        return
      }
      toast.error(error.message || "Failed to update")
    },
  })

  // Full filtered list - drives the summary strip, the pending-approval callout
  // and the day groups. Nothing is paginated: both non-board views collapse by
  // day instead, which is what makes a full week fit on one screen.
  const tasks = useMemo(() => {
    // Array.isArray, not just `?? []`. This ["my-tasks"] entry is shared with
    // MyProgress and is patched in place on drag, so a shape mismatch from
    // either side used to reach `.filter` and take the whole route down with
    // "a.filter is not a function". An unexpected shape should render empty,
    // not crash the page.
    const rows = Array.isArray(data?.data) ? data.data : []
    return rows.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      // Adhoc work has no project, so it filters on the sentinel rather than an id.
      if (projectFilter !== "all" && (t.project?.id ?? ADHOC_ROW_ID) !== projectFilter) return false
      // Compared as a local calendar day, so a task due "today" matches today
      // regardless of the time-of-day stored on it. The sheet view is scoped by
      // its own week stepper, so a single-day filter would empty the grid.
      if (viewMode !== "sheet" && dateFilter && dayKey(t.dueDate) !== dateFilter) return false
      return true
    })
  }, [data, statusFilter, projectFilter, dateFilter, viewMode])

  // A week of allocation is 20+ rows, which is unreadable as one flat list. The
  // card view groups by DAY (the unit the allocation sheet is written in) and
  // collapses each day, so you open the day you are working on.
  const dayGroups = useMemo(() => {
    const now = new Date()
    const map = new Map<string, MyTask[]>()
    for (const t of tasks) {
      const key = dayKey(t.dueDate)
      const list = map.get(key)
      if (list) list.push(t)
      else map.set(key, [t])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === NO_DATE ? 1 : b === NO_DATE ? -1 : a.localeCompare(b)))
      .map(([key, list]) => ({
        key,
        label: dayLabel(key),
        tasks: list,
        allocated: list.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0),
        done: list.filter((t) => t.status === "DONE").length,
        overdue: list.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE")
          .length,
      }))
  }, [tasks])

  // Undefined means "not touched by the user", so the default (today and
  // anything overdue open, the rest shut) applies without an effect that would
  // fight the user's own clicks.
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const todayKey = dayKey(new Date().toISOString())
  const isDayOpen = (g: (typeof dayGroups)[number]) =>
    openDays[g.key] ?? (g.key === todayKey || g.overdue > 0)
  const setAllDays = (open: boolean) =>
    setOpenDays(Object.fromEntries(dayGroups.map((g) => [g.key, open])))

  const doneCount = tasks.filter((t) => t.status === "DONE").length
  const overdueCount = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE",
  ).length

  // ── Sheet view inputs ──────────────────────────────────────────────────────
  // Rows are clients, so the grid needs the project list itself, not just the
  // projects that happen to have work this week - a blank row is where next
  // week's plan gets typed. The project filter narrows the rows the same way it
  // narrows every other view.
  const sheetProjects = useMemo(
    () =>
      myProjects
        .filter((p) => projectFilter === "all" || p.id === projectFilter)
        .map((p) => ({ id: p.id, name: p.name, code: p.code })),
    [myProjects, projectFilter],
  )

  /** Hide the Adhoc row only when the filter has narrowed to a single client. */
  const showAdhocRow = projectFilter === "all" || projectFilter === ADHOC_ROW_ID
  /** Whose plan is being written - you, or the report whose sheet is open. */
  const sheetAssigneeId = isMine ? (session?.user?.id ?? "") : person

  const isAdmin = can(PERMISSIONS.PROJECT_WRITE)
  const actor = useMemo(
    () => ({ userId: session?.user?.id ?? "", isAdmin }),
    [session?.user?.id, isAdmin],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={isMine ? "My Tasks" : `Tasks · ${scopeLabel}`}
        description={
          isMine
            ? "Tasks assigned to you across all projects."
            : `${scopeLabel}'s tasks, across all projects.`
        }
        actions={
          <>
            {/* Only rendered for someone who actually has reports. The options
                come from the server, so the list is also the authorisation -
                you cannot pick a person who isn't yours to see. */}
            {managesSomething && (
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="h-8 w-48 text-sm" aria-label="Whose tasks">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Named, not "Me" - the list reads as people, so the person
                      you are reads the same way as everyone else on it. */}
                  <SelectItem value={MYSELF}>{myName}</SelectItem>
                  {/* No group heading: everyone below is a report, and the list
                      is short enough that a label just adds a line to read. */}
                  {selectablePeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Task
            </Button>
          </>
        }
      />
      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Summary strip */}
      <StatStrip
        items={[
          { label: "Total", value: tasks.length },
          {
            label: "Done",
            value: doneCount,
            tone: doneCount > 0 ? "success" : "default",
          },
          {
            label: "Overdue",
            value: overdueCount,
            tone: overdueCount > 0 ? "danger" : "default",
          },
        ]}
      />

      {/* Filter + view toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Project:</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {/* Work with no client is still work you may want to look at alone. */}
              <SelectItem value={ADHOC_ROW_ID}>{ADHOC_LABEL}</SelectItem>
              {myProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-muted-foreground ml-1 text-xs">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {TASK_WORKFLOW_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Due date. Empty = every date, which is the default; the X clears
              back to it rather than making you hunt for an "All" row inside a
              calendar that has no such day. Hidden in the sheet view, which
              steps a whole week at a time instead. */}
          {viewMode !== "sheet" && (
            <>
              <span className="text-muted-foreground ml-1 text-xs">Due:</span>
              <div className="flex items-center gap-1">
                <DateField
                  value={dateFilter}
                  onChange={setDateFilter}
                  placeholder="All dates"
                  className="h-8 w-40"
                />
                {dateFilter && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Show all dates"
                    aria-label="Show all dates"
                    onClick={() => setDateFilter("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode !== "sheet" && dayGroups.length > 1 && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setAllDays(true)}
              >
                Expand all
              </button>
              <span aria-hidden>·</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => setAllDays(false)}
              >
                Collapse all
              </button>
            </div>
          )}
          {/* Two views only: the sheet is the week's plan, the cards are the
              day-by-day list. A table of the same rows and a board that only
              moved status both said less than either. */}
          <ViewToggle value={viewMode} onChange={setViewMode} showTable={false} showSheet />
        </div>
      </div>

      {/* Sheet or day cards */}
      {isLoading ? (
        <Skeleton className="h-64 rounded" />
      ) : viewMode === "sheet" ? (
        // Before the empty check: an empty week is exactly when you need the
        // grid, because the blank cells are what you type the plan into.
        <TasksSheetView
          tasks={tasks}
          projects={sheetProjects}
          assigneeId={sheetAssigneeId}
          currentUserId={session?.user?.id ?? ""}
          isAdmin={isAdmin}
          showAdhoc={showAdhocRow}
        />
      ) : tasks.length === 0 ? (
        <EmptyState icon={Inbox} variant="card" title="No tasks match the filter." />
      ) : (
        dayGroups.map((group) => {
          const expanded = isDayOpen(group)
          return (
            <Card key={group.key} className={cn(!expanded && "bg-muted/20")}>
              <CardContent className="p-0">
                <DayHeader
                  group={group}
                  expanded={expanded}
                  onToggle={() => setOpenDays((prev) => ({ ...prev, [group.key]: !expanded }))}
                />

                {expanded && (
                  <div className="space-y-2 border-t px-4 py-3">
                    {group.tasks.map((task) => {
                      const isOverdue =
                        task.dueDate &&
                        new Date(task.dueDate) < new Date() &&
                        task.status !== "DONE"
                      const isRejected = task.approvalStatus === "REJECTED"
                      // Same rule the sheet and the API use, so a card never
                      // offers an edit the server is going to refuse.
                      const editable = canEditTaskDetails(taskSubject(task), actor)

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-3 rounded-[2px] border p-2.5",
                            isOverdue &&
                              "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
                            isRejected && "border-red-200 bg-red-50/40",
                            !isOverdue && !isRejected && "border-border",
                          )}
                        >
                          <TaskStatusSelect
                            value={task.status}
                            disabled={isRejected}
                            triggerClassName="h-8 w-32 text-xs"
                            onCommit={(payload) => updateMut.mutate({ id: task.id, ...payload })}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{task.title}</p>
                              {/* The wording is settled - say so here rather
                                  than after someone tries to change it. */}
                              {!editable && (
                                <span
                                  title={taskEditLockReason(taskSubject(task), actor) ?? undefined}
                                  className="text-muted-foreground/50 shrink-0"
                                >
                                  <Lock className="h-3 w-3" aria-label="Locked" />
                                </span>
                              )}
                              {isRejected && (
                                <Badge
                                  variant="outline"
                                  className="border-red-200 bg-red-100 text-[10px] text-red-700"
                                >
                                  Rejected
                                </Badge>
                              )}
                              <BlockedBadge requirement={task.requirement} />
                              {isOverdue && (
                                <Badge
                                  variant="outline"
                                  className="border-red-200 bg-red-50 text-[10px] text-red-700"
                                >
                                  <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                                  Overdue
                                </Badge>
                              )}
                            </div>
                            {task.rejectionReason && (
                              <p className="mt-0.5 text-[11px] text-red-700">
                                Reason: {task.rejectionReason}
                              </p>
                            )}
                            {/* What actually happened - the sheet's Actual
                                column. Read-only here: the card is a list you
                                scan, and the sheet is where a week gets written. */}
                            {task.description && (
                              <p className="text-muted-foreground mt-0.5 text-[11px] whitespace-pre-wrap">
                                {task.description}
                              </p>
                            )}
                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                              <ProjectLink task={task} className="hover:text-foreground" />
                              {task.team && <span>· {task.team.name}</span>}
                              <StatusBadge
                                status={task.priority}
                                colorMap={TASK_PRIORITY_COLORS}
                                labelMap={TASK_PRIORITY_LABELS}
                                size="xs"
                              />
                              <TaskTime
                                estimatedHours={task.estimatedHours}
                                loggedHours={task.loggedHours}
                                inProgressSince={task.inProgressSince}
                              />
                              <TaskHistoryDialog taskId={task.id} taskTitle={task.title} />
                            </div>
                            {/* Resources are editable here, unlike the rest:
                                attaching the published URL is what you do when
                                the work goes out, and that is as likely to be
                                from this list as from the sheet. */}
                            <TaskResources
                              links={task.links ?? []}
                              canEdit={!isRejected}
                              onCommit={(links) => updateMut.mutate({ id: task.id, links })}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

interface DayGroup {
  key: string
  label: string
  tasks: MyTask[]
  allocated: number
  done: number
  overdue: number
}

/**
 * Accordion header for one day: the FAQ pattern, so a week of allocation reads
 * as five closed rows rather than one 22-row wall. Carries the day's totals so
 * a collapsed day still tells you whether it needs opening.
 */
function DayHeader({
  group,
  expanded,
  onToggle,
}: {
  group: DayGroup
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-[2px] px-4 py-3 text-left transition-colors"
    >
      {expanded ? (
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      ) : (
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-semibold">{group.label}</span>
      <span className="text-muted-foreground text-xs">
        {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
        {group.allocated > 0 && ` · ${formatHours(group.allocated)} allocated`}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {group.overdue > 0 && (
          <Badge variant="outline" className="border-red-300 py-0 text-[10px] text-red-700">
            <AlertTriangle className="mr-0.5 inline h-3 w-3" />
            {group.overdue} overdue
          </Badge>
        )}
        {group.done > 0 && (
          <Badge variant="outline" className="border-emerald-300 py-0 text-[10px] text-emerald-700">
            {group.done} done
          </Badge>
        )}
      </span>
    </button>
  )
}
