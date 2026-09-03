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

// =============================================================================
// The list behind a number.
//
// Every drill-down on the Progress page ends here: a flat list of the tasks a
// tile, slice or bar was counting, grouped so it reads as an answer ("these
// twelve, on these three clients") rather than a dump. Fetches from
// /api/projects/tasks, whose state buckets are the performance route's, so the
// list length always equals the count that was clicked.
//
// ── BUILT FOR 275 ROWS, NOT 12 ───────────────────────────────────────────────
// "Completed, all time" is a real click and it is hundreds of rows across
// several clients. The first version rendered them as one long scroll, so
// reaching the second client meant scrolling past every row of the first. So:
//
//   jump chips  - one per group, with its count. Click one and the list shows
//                 ONLY that group. This is the fix for "scroll past 32 to see
//                 the next client": you do not scroll, you pick.
//   collapse    - every group header is a toggle, and there is a collapse-all.
//   search      - title, assignee, client, team. Local, instant.
//   one line    - the team rides inline after the title; the second line only
//                 exists when there is something to say on it.
//   show more   - the server caps a page; the footer says so and fetches more.
//
// The toolbar is STICKY inside the popup's scroll area, so the controls stay
// under your hand however far down you are.
// =============================================================================

export type TaskState = State | "open" | "all"

export interface TaskListFilters {
  state?: TaskState
  projectId?: string
  assigneeId?: string
  teamId?: string
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
}

/** The chips over a list: the five chart states plus "everything". */
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

/**
 * Which of the five chart states a task is in - the client-side twin of the
 * server's buckets, for views that fetch once and filter locally.
 * Discarded work belongs to no state and returns null.
 */
export function stateOfTask(t: DrillTask): State | null {
  if (t.status === "DONE") return "done"
  if (t.status === "DISCARDED" || t.status === "CANCELLED") return null
  if (t.status === "ON_HOLD") return "hold"
  if (t.overdue) return "overdue"
  if (t.status === "IN_PROGRESS" || t.status === "IN_REVIEW") return "progress"
  return "todo"
}

export function matchesState(t: DrillTask, state: TaskState): boolean {
  if (state === "all") return true
  if (state === "open") return t.status !== "DONE" && t.status !== "DISCARDED"
  return stateOfTask(t) === state
}

/** One task, one line. Two only when there is a second thing to say. */
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
  const secondLine = (showProject && t.project) || (t.status === "ON_HOLD" && t.holdExpectedDate)
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
          </p>
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

      {/* "—" for nothing logged rather than "0m": a zero here usually means the
          clock was never started, not that the work took no time. */}
      {(t.estimatedHours != null || t.loggedHours > 0) && (
        <span className="text-muted-foreground hidden w-24 shrink-0 items-center justify-end gap-1 tabular-nums sm:inline-flex">
          <Timer className="h-3 w-3" />
          {t.loggedHours > 0 ? formatHours(t.loggedHours) : "—"}
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

/**
 * Presentational list, grouped, with its own toolbar.
 *
 * Takes rows so a view that fetched once can filter locally (the person popup)
 * and a view that fetched per state can just hand them over. `compact` drops
 * the toolbar and caps the rows - for a summary panel that has a "see all".
 */
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
  /** Cap the rows rendered (compact panels). */
  limit?: number
}) {
  const [query, setQuery] = React.useState("")
  const [only, setOnly] = React.useState<string | null>(null)
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set())

  const showProj = showProject ?? groupBy !== "project"

  // Group FIRST, then search within - so the jump chips keep their true counts
  // and a search never makes a client vanish from the chip row.
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

  // Compact: no toolbar, first N rows, and a group header only when the rows
  // actually span groups.
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
            <label className="border-input bg-background focus-within:border-ring flex h-8 min-w-56 flex-1 items-center gap-2 rounded-[4px] border px-2 text-xs">
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
                size="sm"
                className="text-muted-foreground h-7 gap-1 px-2 text-[11px]"
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

          {/* Jump chips: pick a client instead of scrolling to it. */}
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
        "inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "border-foreground/40 bg-muted font-medium"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

/** Fetch + render, with "show more" when the server capped the page. */
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
  /** Compact panels: rows to render. */
  limit?: number
}) {
  const [page, setPage] = React.useState(PAGE)
  const { data, isLoading, isFetching } = useTaskList(
    filters,
    true,
    compact ? (limit ?? PAGE) : page,
  )
  if (isLoading && !data) return <Skeleton className="m-4 h-40 rounded" />
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            disabled={isFetching}
            onClick={() => setPage((p) => p + PAGE)}
          >
            {isFetching ? "Loading…" : `Show ${Math.min(PAGE, data.total - data.data.length)} more`}
          </Button>
        </div>
      )}
    </div>
  )
}
