"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  ListChecks,
  PauseCircle,
  Search,
  Target,
  Timer,
  X,
} from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
} from "@/lib/constants"
import { formatHours } from "../lib/format-hours"
import { projectHref } from "../lib/project-href"
import { STATES, type State } from "./portfolio-charts"

// The tasks behind a Progress number; the API's buckets match the performance route, so the counts agree.

export type TaskState = State | "open" | "all"

export interface TaskListFilters {
  state?: TaskState
  projectId?: string
  assigneeId?: string
  teamId?: string
  goalId?: string
  /** Only tasks serving no goal. */
  unlinked?: boolean
  from?: string | null
  to?: string | null
}

export interface DrillTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  loggedHours: number
  running: boolean
  holdExpectedDate: string | null
  overdue: boolean
  daysLate: number
  project: { id: string; name: string; code: string; slug: string | null } | null
  team: { id: string; name: string } | null
  assignee: { id: string; name: string; profilePhoto: string | null } | null
  /** The goal it serves. Null = unlinked. */
  goal: { id: string; title: string } | null
  producesOutput: boolean
  outputs: number
  /** Answered "nothing came out of this" - a real answer, not an omission. */
  outputSkipped: boolean
}

export interface TaskListFiltersExtra {
  goalId?: string
  unlinked?: boolean
}

export const STATE_CHIPS: { key: TaskState; label: string }[] = [
  { key: "all", label: "All" },
  ...STATES.map((s) => ({ key: s.key as TaskState, label: s.label })),
]

/** One page of rows. Grows by this much on "show more". */
export const PAGE = 150

export function useTaskList(filters: TaskListFilters, enabled = true, limit = PAGE) {
  const qs = new URLSearchParams()
  if (filters.state && filters.state !== "all") qs.set("state", filters.state)
  if (filters.projectId) qs.set("projectId", filters.projectId)
  if (filters.assigneeId) qs.set("assigneeId", filters.assigneeId)
  if (filters.teamId) qs.set("teamId", filters.teamId)
  if (filters.goalId) qs.set("goalId", filters.goalId)
  if (filters.unlinked) qs.set("unlinked", "1")
  if (filters.from) qs.set("from", filters.from)
  if (filters.to) qs.set("to", filters.to)
  qs.set("limit", String(limit))
  const query = qs.toString()

  return useQuery({
    queryKey: ["progress-tasks", query],
    queryFn: () =>
      apiFetch<{ data: DrillTask[]; total: number; truncated: boolean }>(
        `/api/projects/tasks?${query}`,
      ),
    enabled,
    staleTime: 30_000,
    // A bigger page replaces a smaller one; keep the rows on screen meanwhile.
    placeholderData: (prev) => prev,
  })
}

/** Client-side twin of the server's state buckets; discarded work returns null. */
export function stateOfTask(t: DrillTask): State | null {
  if (t.status === "DONE") return "done"
  if (t.status === "DISCARDED" || t.status === "CANCELLED") return null
  // Overdue outranks on-hold, matching the server.
  if (t.overdue) return "overdue"
  if (t.status === "ON_HOLD") return "hold"
  if (t.status === "IN_PROGRESS" || t.status === "IN_REVIEW") return "progress"
  return "todo"
}

export function matchesState(t: DrillTask, state: TaskState): boolean {
  if (state === "all") return true
  if (state === "open")
    return t.status !== "DONE" && t.status !== "DISCARDED" && t.status !== "CANCELLED"
  return stateOfTask(t) === state
}

function TaskRow({
  t,
  showProject,
  showAssignee,
}: {
  t: DrillTask
  showProject: boolean
  showAssignee: boolean
}) {
  const done = t.status === "DONE"
  // Finished, expected to produce something, nothing logged: the nudge.
  const missingOutput =
    done && t.producesOutput && t.outputs === 0 && !t.outputSkipped && t.project !== null
  // Answered "nothing came out of this" - shown quietly, not dropped.
  const skippedOutput = done && t.producesOutput && t.outputSkipped
  const secondLine =
    (showProject && t.project) || (t.status === "ON_HOLD" && t.holdExpectedDate) || t.goal
  return (
    <li className="hover:bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-xs transition-colors">
      <div className="min-w-48 flex-1">
        <p className={cn("font-medium", done && "text-muted-foreground")}>
          {t.title}
          {t.team && (
            <span className="text-muted-foreground ml-1.5 text-[10px] font-normal tracking-wide uppercase">
              {t.team.name}
            </span>
          )}
          {t.running && (
            <span
              title="Clock running"
              className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500 align-middle"
            />
          )}
        </p>
        {secondLine && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[11px]">
            {showProject && t.project && (
              <Link
                href={projectHref(t.project, "tasks")}
                className="hover:text-foreground inline-flex items-center gap-0.5 underline-offset-4 hover:underline"
              >
                {t.project.name} <ArrowUpRight className="h-2.5 w-2.5" />
              </Link>
            )}
            {t.status === "ON_HOLD" && t.holdExpectedDate && (
              <span className="inline-flex items-center gap-1">
                <PauseCircle className="h-3 w-3" /> resumes {formatDate(t.holdExpectedDate)}
              </span>
            )}
            {t.goal && (
              <span className="inline-flex items-center gap-1" title="The goal this task serves">
                <Target className="h-3 w-3" /> {t.goal.title}
              </span>
            )}
          </p>
        )}
        {missingOutput && (
          <p className="mt-0.5 text-[11px] text-amber-500">No output logged for this task</p>
        )}
        {skippedOutput && (
          <p className="text-muted-foreground mt-0.5 text-[11px]">Nothing to log</p>
        )}
      </div>

      {showAssignee && t.assignee && (
        <span className="flex w-36 shrink-0 items-center gap-1.5">
          <AvatarDisplay
            src={t.assignee.profilePhoto}
            firstName={t.assignee.name.split(" ")[0] ?? ""}
            lastName={t.assignee.name.split(" ").slice(1).join(" ")}
            size="xs"
          />
          <span className="text-muted-foreground truncate">{t.assignee.name}</span>
        </span>
      )}

      <StatusBadge
        status={t.status}
        colorMap={TASK_STATUS_COLORS}
        labelMap={TASK_STATUS_LABELS}
        size="xs"
        className="w-20 justify-center"
      />
      {!done && (
        <StatusBadge
          status={t.priority}
          colorMap={TASK_PRIORITY_COLORS}
          labelMap={TASK_PRIORITY_LABELS}
          size="xs"
          className="w-16 justify-center"
        />
      )}

      {/* "-" rather than "0m": a zero usually means the clock was never started. */}
      {(t.estimatedHours != null || t.loggedHours > 0) && (
        <span className="text-muted-foreground hidden w-24 shrink-0 items-center justify-end gap-1 tabular-nums sm:inline-flex">
          <Timer className="h-3 w-3" />
          {t.loggedHours > 0 ? formatHours(t.loggedHours) : "-"}
          {t.estimatedHours != null && ` / ${formatHours(t.estimatedHours)}`}
        </span>
      )}

      {t.overdue ? (
        <span className="text-destructive inline-flex w-36 shrink-0 items-center justify-end gap-1 font-medium tabular-nums">
          <AlertTriangle className="h-3 w-3" />
          {formatDate(t.dueDate)} · {t.daysLate}d late
        </span>
      ) : (
        <span className="text-muted-foreground w-36 shrink-0 text-right tabular-nums">
          {done
            ? t.completedAt
              ? `done ${formatDate(t.completedAt)}`
              : "done"
            : t.dueDate
              ? `due ${formatDate(t.dueDate)}`
              : "no date"}
        </span>
      )}
    </li>
  )
}

interface Group {
  key: string
  label: string
  tasks: DrillTask[]
}

const haystack = (t: DrillTask) =>
  [t.title, t.assignee?.name, t.project?.name, t.project?.code, t.team?.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

/** Takes rows so a view can filter locally or pass them through; `compact` drops the toolbar and caps rows. */
export function TaskRows({
  tasks,
  groupBy = "project",
  showProject,
  showAssignee = true,
  emptyTitle = "No tasks in this scope.",
  compact = false,
  limit,
}: {
  tasks: DrillTask[]
  groupBy?: "project" | "assignee" | "none"
  showProject?: boolean
  showAssignee?: boolean
  emptyTitle?: string
  compact?: boolean
  limit?: number
}) {
  const [query, setQuery] = React.useState("")
  const [only, setOnly] = React.useState<string | null>(null)
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set())

  const showProj = showProject ?? groupBy !== "project"

  // Group first, then search, so the jump chips keep their true counts.
  const groups = React.useMemo<Group[]>(() => {
    if (groupBy === "none") return [{ key: "__all", label: "", tasks }]
    const map = new Map<string, Group>()
    for (const t of tasks) {
      const key = groupBy === "project" ? (t.project?.id ?? "__none") : (t.assignee?.id ?? "__none")
      const label =
        groupBy === "project" ? (t.project?.name ?? "Adhoc") : (t.assignee?.name ?? "Unassigned")
      const g = map.get(key) ?? { key, label, tasks: [] }
      g.tasks.push(t)
      map.set(key, g)
    }
    // Biggest first: it is the one the number was mostly made of.
    return [...map.values()].sort((a, b) => b.tasks.length - a.tasks.length)
  }, [tasks, groupBy])

  if (tasks.length === 0) return <EmptyState icon={ListChecks} compact title={emptyTitle} />

  const q = query.trim().toLowerCase()
  const visible = groups
    .filter((g) => !only || g.key === only)
    .map((g) => ({ ...g, tasks: q ? g.tasks.filter((t) => haystack(t).includes(q)) : g.tasks }))
    .filter((g) => g.tasks.length > 0)
  const shown = visible.reduce((s, g) => s + g.tasks.length, 0)

  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const allCollapsed = visible.length > 0 && visible.every((g) => collapsed.has(g.key))

  if (compact) {
    const rows = tasks.slice(0, limit ?? tasks.length)
    return (
      <ul className="divide-border/60 divide-y">
        {rows.map((t) => (
          <TaskRow key={t.id} t={t} showProject={showProj} showAssignee={showAssignee} />
        ))}
        {limit != null && tasks.length > limit && (
          <li className="text-muted-foreground px-4 py-2 text-[11px]">
            and {tasks.length - limit} more
          </li>
        )}
      </ul>
    )
  }

  const hasToolbar = tasks.length > 8 || groups.length > 1

  return (
    <div>
      {hasToolbar && (
        <div className="bg-background/95 border-border/60 sticky top-0 z-10 space-y-2 border-b px-4 py-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <label className="border-input bg-background focus-within:border-ring flex h-8 min-w-56 flex-1 items-center gap-2 rounded-sm border px-2 text-xs">
              <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${tasks.length} tasks…`}
                aria-label="Search tasks"
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {shown === tasks.length ? `${tasks.length} tasks` : `${shown} of ${tasks.length}`}
              {groups.length > 1 &&
                !only &&
                ` · ${groups.length} ${groupBy === "project" ? "clients" : "people"}`}
            </span>
            {groups.length > 1 && (
              <Button
                variant="ghost"
                className="text-muted-foreground px-2"
                onClick={() =>
                  setCollapsed(allCollapsed ? new Set() : new Set(visible.map((g) => g.key)))
                }
              >
                {allCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {allCollapsed ? "Expand all" : "Collapse all"}
              </Button>
            )}
          </div>

          {groups.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={only === null} onClick={() => setOnly(null)}>
                All <span className="tabular-nums opacity-70">{tasks.length}</span>
              </Chip>
              {groups.map((g) => (
                <Chip
                  key={g.key}
                  active={only === g.key}
                  onClick={() => setOnly(only === g.key ? null : g.key)}
                >
                  {g.label} <span className="tabular-nums opacity-70">{g.tasks.length}</span>
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon={Search} compact title={`Nothing matches "${query}".`} />
      ) : groupBy === "none" ? (
        <ul className="divide-border/60 divide-y">
          {visible[0]!.tasks.map((t) => (
            <TaskRow key={t.id} t={t} showProject={showProj} showAssignee={showAssignee} />
          ))}
        </ul>
      ) : (
        <div className="divide-border/60 divide-y">
          {visible.map((g) => {
            const isCollapsed = collapsed.has(g.key)
            return (
              <section key={g.key}>
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={!isCollapsed}
                  className="bg-muted/40 hover:bg-muted/70 flex w-full items-center gap-2 px-4 py-1.5 text-left text-[11px] font-medium transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="text-muted-foreground h-3 w-3" />
                  ) : (
                    <ChevronDown className="text-muted-foreground h-3 w-3" />
                  )}
                  <span>{g.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {g.tasks.length} {g.tasks.length === 1 ? "task" : "tasks"}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul className="divide-border/60 divide-y">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        t={t}
                        showProject={showProj}
                        showAssignee={showAssignee && groupBy !== "assignee"}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-foreground/40 bg-muted font-medium"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function TaskList({
  filters,
  groupBy,
  showProject,
  showAssignee,
  emptyTitle,
  compact,
  limit,
}: {
  filters: TaskListFilters
  groupBy?: "project" | "assignee" | "none"
  showProject?: boolean
  showAssignee?: boolean
  emptyTitle?: string
  compact?: boolean
  limit?: number
}) {
  const [page, setPage] = React.useState(PAGE)
  const { data, isLoading, isFetching } = useTaskList(
    filters,
    true,
    compact ? (limit ?? PAGE) : page,
  )
  if (isLoading && !data) return <Skeleton className="m-4 h-40 rounded-sm" />
  return (
    <div>
      <TaskRows
        tasks={data?.data ?? []}
        groupBy={groupBy}
        showProject={showProject}
        showAssignee={showAssignee}
        emptyTitle={emptyTitle}
        compact={compact}
        limit={limit}
      />
      {!compact && data?.truncated && (
        <div className="border-border/60 flex items-center justify-between gap-3 border-t px-4 py-2">
          <p className="text-muted-foreground text-[11px]">
            Showing {data.data.length} of {data.total}
          </p>
          <Button variant="outline" disabled={isFetching} onClick={() => setPage((p) => p + PAGE)}>
            {isFetching ? "Loading…" : `Show ${Math.min(PAGE, data.total - data.data.length)} more`}
          </Button>
        </div>
      )}
    </div>
  )
}
