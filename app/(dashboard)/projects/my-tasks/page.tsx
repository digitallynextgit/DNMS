"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Link } from "@/components/tenant-link"
import { AlertTriangle, ChevronDown, ChevronRight, Inbox, Lock, Target, X } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { StatStrip } from "@/components/shared/stat-strip"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import {
  ADHOC_LABEL,
  ADHOC_ROW_ID,
  canEditTaskDetails,
  resolveTaskManagerId,
  taskEditLockReason,
} from "@/features/projects/lib/task-permissions"
import { TaskResources } from "@/features/projects/components/task-resources"
import { TasksExportMenu } from "@/features/projects/components/tasks-export-menu"
import { cn } from "@/lib/utils"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { TaskStatusSelect } from "@/features/projects/components/task-status-select"
import { TaskTime } from "@/features/projects/components/task-time"
import { TaskHistoryDialog } from "@/features/projects/components/task-history-dialog"
import { formatHours } from "@/features/projects/lib/format-hours"
import { projectHref } from "@/features/projects/lib/project-href"
import { followUpConflictFrom } from "@/features/projects/lib/follow-up-conflict"
import { afterTaskPatch } from "@/features/projects/lib/after-task-patch"
import { useFollowUpConflictStore } from "@/stores/follow-up-conflict-store"
import { apiFetch } from "@/lib/api-fetch"
import { BlockedBadge } from "@/features/projects/components/blocked-badge"
import { useProjects } from "@/features/projects/hooks/use-projects"
import { DateField } from "@/components/shared/date-field"
import { useSession } from "next-auth/react"
import { TaskCreateDialog } from "@/features/projects/components/task-create-dialog"
import { TasksSheetView } from "@/features/projects/components/tasks-sheet-view"
import { MyTasksSheetSkeleton } from "@/features/projects/components/my-tasks-skeleton"
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
  links: string[]
  /** Non-null while the task sits In Progress and its clock is running. */
  inProgressSince: string | null
  approvalStatus: "APPROVED" | "PENDING_APPROVAL" | "REJECTED"
  rejectionReason: string | null
  /** Who raised it, and when - together these decide the 15-minute edit window. */
  creatorId: string
  createdAt: string
  /** Null for ADHOC work (meetings, interviews - no client). */
  project: { id: string; name: string; code: string; slug: string | null } | null
  team?: { id: string; name: string; managerId: string | null } | null
  requirement?: { id: string; title: string; status: string } | null
  /** managerId is the authority on adhoc work, which has no team manager. */
  assignee?: { id: string; firstName: string; lastName: string; managerId?: string | null } | null
  goal?: { id: string; title: string } | null
  producesOutput?: boolean
  /** Set when someone answered "nothing came out of this" - the nudge stops. */
  outputSkippedAt?: string | null
  _count?: { deliverables: number }
}

/** "me" | "user:<id>" */
type TaskScope = string

interface ScopeMeta {
  /** isReport = a direct subordinate; false = only on a team you manage. */
  people: { id: string; name: string; isReport: boolean; former?: boolean }[]
  /** Project admin: `people` is the whole company. Decided (and authorised) by the server. */
  seesEveryone?: boolean
}

const MYSELF = "me"

const PERSON_KEY = "my-tasks:person"

const subscribeNever = () => () => {}

function readStoredPerson(): string | null {
  try {
    return localStorage.getItem(PERSON_KEY)
  } catch {
    return null
  }
}

/**
 * Last-viewed person, kept across reloads. Read through useSyncExternalStore, not a lazy
 * initialiser: there is no localStorage on the server, so that would cause a hydration mismatch.
 */
function usePersistedPerson(): [string, (v: string) => void] {
  const [person, setPersonState] = useState<string>(MYSELF)

  // Undefined on the server and while hydrating; restored once, like a mount effect.
  const stored = useSyncExternalStore<string | null | undefined>(
    subscribeNever,
    readStoredPerson,
    () => undefined,
  )
  const [restored, setRestored] = useState(false)
  if (stored !== undefined && !restored) {
    setRestored(true)
    if (stored) setPersonState(stored)
  }

  const setPerson = useCallback((v: string) => {
    setPersonState(v)
    try {
      // Yourself is stored as no value, so no stale id outlives a reporting change.
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

// apiFetch keeps the server's error code and details - the follow-up question needs them.
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

/** Same resolution as the API, so the card shows the lock the server would enforce. */
function taskSubject(task: MyTask) {
  return {
    creatorId: task.creatorId,
    createdAt: task.createdAt,
    // Must be the real value (null = adhoc) - it decides who may keep editing.
    projectId: task.project?.id ?? null,
    assigneeId: task.assignee?.id ?? null,
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
  // Sheet is the default; anything else stored (retired table/board views) folds back to it.
  const [storedView, setViewMode] = useViewMode("my-tasks:view", "sheet")
  const viewMode = storedView === "card" ? "card" : "sheet"
  const qc = useQueryClient()
  const askFollowUpConflict = useFollowUpConflictStore((s) => s.ask)

  const { data: session } = useSession()
  const { can } = usePermissions()
  const myName = session?.user
    ? `${session.user.firstName} ${session.user.lastName}`.trim()
    : "My tasks"

  // Same list the projects board shows, so the filter never offers a project they can't open.
  const { data: projectsData } = useProjects()
  const myProjects = useMemo(() => projectsData?.data ?? [], [projectsData])

  // One person's sheet at a time: you, a subordinate, or (project admins) anyone. Never merged.
  const [person, setPerson] = usePersistedPerson()
  const isMine = person === MYSELF

  const scope: TaskScope = isMine ? MYSELF : `user:${person}`

  // "me" keeps the bare ["my-tasks"] key: MyProgress shares it and drag patches it in place.
  const queryKey = useMemo(() => (isMine ? ["my-tasks"] : ["my-tasks", scope]), [isMine, scope])
  const { data, isLoading, isError } = useQuery({ queryKey, queryFn: () => fetchMyTasks(scope) })

  // Built from the server's list and held across refetches: a scope switch briefly clears
  // `data`, and rebuilding from that would collapse the menu mid-selection.
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta>({ people: [], seesEveryone: false })
  // Not the same as an empty list: until the first response, the guard below must not reset
  // a restored selection.
  const [metaLoaded, setMetaLoaded] = useState(false)
  const [metaFrom, setMetaFrom] = useState<typeof data>(undefined)
  if (data !== metaFrom) {
    setMetaFrom(data)
    if (data?.meta) {
      setScopeMeta(data.meta)
      setMetaLoaded(true)
    }
  }

  /**
   * Managers get direct reports only; project admins get the whole company (`seesEveryone`).
   * The server's list IS the authorisation - an unlisted name falls back to your own tasks.
   */
  const selectablePeople = useMemo(
    () =>
      (scopeMeta.seesEveryone ? scopeMeta.people : scopeMeta.people.filter((p) => p.isReport))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [scopeMeta],
  )
  const canPickPerson = selectablePeople.length > 0
  const currentPeople = useMemo(() => selectablePeople.filter((p) => !p.former), [selectablePeople])
  const formerPeople = useMemo(() => selectablePeople.filter((p) => p.former), [selectablePeople])
  const viewingFormer = !isMine && formerPeople.some((p) => p.id === person)

  // A report who moves away falls back to you - but only once the list has loaded.
  useEffect(() => {
    if (!metaLoaded || person === MYSELF) return
    if (!selectablePeople.some((p) => p.id === person)) setPerson(MYSELF)
  }, [metaLoaded, selectablePeople, person, setPerson])

  /** Real names, never "me". */
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["my-tasks"] })
      afterTaskPatch(data, { successMessage: "Task updated" })
    },
    onError: (error: Error, variables) => {
      // A hold follow-up whose original is already underway: ask rather than fail.
      const conflict = followUpConflictFrom(error)
      if (conflict) {
        const { id, ...body } = variables
        askFollowUpConflict({
          ...conflict,
          keep: async () => {
            const kept = await updateTask(id, { ...body, keepFollowUp: true })
            qc.invalidateQueries({ queryKey: ["my-tasks"] })
            afterTaskPatch(kept, { successMessage: "Task updated" })
          },
        })
        return
      }
      toast.error(error.message || "Failed to update")
    },
  })

  const tasks = useMemo(() => {
    // Array.isArray, not `?? []`: this cache entry is shared with MyProgress and patched on
    // drag, so an unexpected shape must render empty rather than crash the page.
    const rows = Array.isArray(data?.data) ? data.data : []
    return rows.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false
      // Adhoc work has no project, so it filters on the sentinel rather than an id.
      if (projectFilter !== "all" && (t.project?.id ?? ADHOC_ROW_ID) !== projectFilter) return false
      // Local calendar day, so "today" matches whatever time is stored. The sheet has its own
      // week stepper, so a single-day filter would empty it.
      if (viewMode !== "sheet" && dateFilter && dayKey(t.dueDate) !== dateFilter) return false
      return true
    })
  }, [data, statusFilter, projectFilter, dateFilter, viewMode])

  // Grouped by day (the unit the allocation sheet uses) and collapsed - a week is 20+ rows.
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

  // Undefined = not touched yet, so the default (today and overdue open) applies without an
  // effect that would fight the user's clicks.
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

  // Rows are clients, so the grid needs the full project list - a blank row is where next
  // week's plan gets typed. For someone else, rows are THEIR accounts plus any with work this week.
  const sheetProjects = useMemo(
    () =>
      myProjects
        .filter((p) => isMine || p.members.some((m) => m.employee.id === person))
        .filter((p) => projectFilter === "all" || p.id === projectFilter)
        .map((p) => ({ id: p.id, name: p.name, code: p.code })),
    [myProjects, projectFilter, isMine, person],
  )

  const showAdhocRow = projectFilter === "all" || projectFilter === ADHOC_ROW_ID
  const sheetAssigneeId = isMine ? (session?.user?.id ?? "") : person

  const isAdmin = can(PERMISSIONS.PROJECT_WRITE)
  const actor = useMemo(
    () => ({ userId: session?.user?.id ?? "", isAdmin }),
    [session?.user?.id, isAdmin],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={isMine ? "My Tasks" : `${viewingFormer ? "Archived" : "Tasks"} · ${scopeLabel}`}
        description={
          isMine
            ? "Tasks assigned to you across all projects."
            : viewingFormer
              ? `${scopeLabel} is no longer with the organisation. Their tasks are kept here for reference.`
              : `${scopeLabel}'s tasks, across all projects.`
        }
        actions={
          <>
            <TasksExportMenu tasks={tasks} scope={isMine ? "my-tasks" : scopeLabel} />
            {canPickPerson && (
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="w-48" aria-label="Whose tasks">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MYSELF}>{myName}</SelectItem>
                  {currentPeople.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {formerPeople.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground text-xs font-normal">
                        Archived · no longer with us
                      </SelectLabel>
                      {formerPeople.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
            {/* Nothing new gets assigned to someone who has left. */}
            {!viewingFormer && (
              <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New Task
              </Button>
            )}
          </>
        }
      />
      <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />

      <StatStrip
        loading={isLoading}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Project:</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-48 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
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

          {/* Empty = every date. Hidden in the sheet view, which steps a whole week. */}
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
                    size="icon"
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
          <ViewToggle value={viewMode} onChange={setViewMode} showTable={false} showSheet />
        </div>
      </div>

      {isLoading ? (
        <MyTasksSheetSkeleton />
      ) : viewMode === "sheet" ? (
        // Before the empty check: an empty week still needs the grid to type the plan into.
        <TasksSheetView
          tasks={tasks}
          axis={{
            by: "client",
            projects: sheetProjects,
            assigneeId: sheetAssigneeId,
            showAdhoc: showAdhocRow,
          }}
          currentUserId={session?.user?.id ?? ""}
          isAdmin={isAdmin}
        />
      ) : isError ? (
        <EmptyState icon={Inbox} variant="card" title="Couldn't load your tasks. Try reloading." />
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
                      // Same rule as the sheet and the API.
                      const editable = canEditTaskDetails(taskSubject(task), actor)

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            // Phones stack: the 128px status select is too wide beside the title.
                            "flex flex-col items-stretch gap-2 rounded-sm border p-2.5 sm:flex-row sm:items-center sm:gap-3",
                            isOverdue &&
                              "border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20",
                            isRejected && "border-red-200 bg-red-50/40",
                            !isOverdue && !isRejected && "border-border",
                          )}
                        >
                          <TaskStatusSelect
                            value={task.status}
                            disabled={isRejected}
                            triggerClassName="h-8 w-full text-xs sm:w-32"
                            onCommit={(payload) => updateMut.mutate({ id: task.id, ...payload })}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{task.title}</p>
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
                            {task.goal && (
                              <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
                                <Target className="h-3 w-3 shrink-0" />
                                <span className="truncate">{task.goal.title}</span>
                              </p>
                            )}
                            {task.rejectionReason && (
                              <p className="mt-0.5 text-[11px] text-red-700">
                                Reason: {task.rejectionReason}
                              </p>
                            )}
                            {/* Read-only here; the sheet is where the Actual column is written. */}
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
                            {/* Editable here: the published URL is often added from this list. */}
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

/** Accordion header for one day, with totals so a collapsed day shows if it needs opening. */
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
      className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors"
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
