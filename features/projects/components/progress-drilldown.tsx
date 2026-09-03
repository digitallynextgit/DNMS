"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Gauge,
  Target,
} from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { useProjectProgress } from "../hooks/use-projects"
import { formatHours } from "../lib/format-hours"
import { projectHref } from "../lib/project-href"
import { SeoRow } from "./project-progress-detail"
import { GoalTree, useGoalsPortfolio, type ProjectGoalsRow } from "./goals-progress-card"
import { fmtDate } from "./goal-status"
import {
  PaceLine,
  StateDonut,
  StateLegend,
  StateStack,
  statesOf,
  type ChartBucket,
  type ChartRow,
} from "./portfolio-charts"
import {
  STATE_CHIPS,
  TaskList,
  TaskRows,
  matchesState,
  stateOfTask,
  useTaskList,
  type DrillTask,
  type TaskState,
} from "./progress-task-list"

// =============================================================================
// The popup behind every number on the Progress page.
//
// One dialog, four kinds of content:
//
//   state   - "which 42?": the tasks a tile or slice was counting
//   client  - one project as a mini dashboard: overview, tasks, people, goals,
//             hours. Reuses the per-project progress query, so it agrees with
//             the project's own Overview tab to the task.
//   person  - one person across the scope: their mix, their punctuality, their
//             tasks grouped by client
//   goals   - the goal tree, for one project or every project in scope
//
// ── A STACK, NOT A ROUTER ────────────────────────────────────────────────────
// Popups open popups: a client's People tab opens a person, whose task list
// names clients. Rather than a second dialog on top of the first, the content
// is a stack with a Back button - the same window, one step deeper. A
// dialog-on-dialog is where every "professional dashboard" starts to feel like
// a filing cabinet.
//
// ── EVERY VIEW SAYS ITS SCOPE ────────────────────────────────────────────────
// The page mixes "as of today" (overdue, goals) with "in the date range"
// (everything else) on purpose, so every popup header spells out which one it
// is. A list titled "Overdue" with no scope is a list somebody will argue with.
// =============================================================================

export interface DrillRange {
  from?: string | null
  to?: string | null
}
export interface DrillProject {
  id: string
  name: string
  code?: string
  slug?: string | null
}
export interface DrillPerson {
  id: string
  name: string
  profilePhoto?: string | null
}
export type ClientTab = "overview" | "tasks" | "people" | "goals" | "hours"

export type Drill =
  | {
      kind: "state"
      state: TaskState
      title: string
      subtitle?: string
      projectId?: string
      assigneeId?: string
      teamId?: string
      range?: DrillRange
      groupBy?: "project" | "assignee"
    }
  | {
      kind: "client"
      project: DrillProject
      tab?: ClientTab
      state?: TaskState
      range?: DrillRange
    }
  | {
      kind: "person"
      person: DrillPerson
      projectId?: string
      state?: TaskState
      range?: DrillRange
    }
  | { kind: "goals"; projectId?: string }

/** "due 31 Aug – 6 Sep" or "all time". */
export function rangeLabel(r?: DrillRange): string {
  if (!r?.from) return "all time"
  return `due ${formatDate(r.from, "d MMM")}${r.to ? ` – ${formatDate(r.to, "d MMM")}` : ""}`
}

// The performance query, shared with the page so the client popup opens from
// the cache the page already filled. Same key builder, same order of params.
export function performanceQuery(projectId?: string, range?: DrillRange): string {
  const p = new URLSearchParams()
  if (projectId) p.set("projectId", projectId)
  if (range?.from) p.set("from", range.from)
  if (range?.to) p.set("to", range.to)
  return p.toString()
}

export interface PerformanceData {
  summary: ChartBucket
  overdueNow: number
  trend: { weekStart: string; completed: number; due: number }[]
  byEmployee: (ChartRow & { profilePhoto: string | null })[]
  byProject: (ChartRow & { code: string; slug: string | null })[]
  byTeam: ChartRow[]
  projects: { id: string; name: string; code: string; slug: string | null }[]
  scope: "all" | "mine"
}

export function usePerformance(projectId?: string, range?: DrillRange, enabled = true) {
  const query = performanceQuery(projectId, range)
  return useQuery({
    queryKey: ["project-performance", query],
    queryFn: () =>
      apiFetch<{ data: PerformanceData }>(
        `/api/projects/performance${query ? `?${query}` : ""}`,
      ).then((r) => r.data),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    enabled,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Small parts
// ─────────────────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  tone?: "default" | "good" | "warn" | "bad"
  icon?: typeof Clock
}) {
  return (
    <div className="bg-muted/40 rounded-[6px] px-3 py-2">
      <p className="text-muted-foreground flex items-center gap-1 text-[10px] tracking-widest uppercase">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-bold tabular-nums",
          tone === "good" && "text-emerald-500",
          tone === "warn" && "text-amber-500",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
    </div>
  )
}

function StateChips({
  value,
  onChange,
  counts,
}: {
  value: TaskState
  onChange: (s: TaskState) => void
  counts?: Partial<Record<TaskState, number>>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATE_CHIPS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(c.key)}
          className={cn(
            "rounded-[2px] border px-2 py-0.5 text-[11px] transition-colors",
            value === c.key
              ? "border-foreground/40 bg-muted font-medium"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {c.label}
          {counts?.[c.key] != null && (
            <span className="ml-1 tabular-nums opacity-70">{counts[c.key]}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/**
 * A titled panel. `collapsible` turns the header into a toggle - for a popup
 * that stacks several of these (every project's goals), so a reader can fold
 * the ones they are not reading instead of scrolling past them.
 */
function Section({
  title,
  sub,
  action,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string
  sub?: string
  action?: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  const shown = !collapsible || open
  const heading = (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {collapsible &&
          (open ? (
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          ))}
        <span className="truncate">{title}</span>
      </p>
      {sub && <p className="text-muted-foreground text-[11px]">{sub}</p>}
    </div>
  )
  return (
    <section className="border-border/60 overflow-hidden rounded-[6px] border">
      <div
        className={cn(
          "border-border/60 flex items-baseline justify-between gap-2 px-4 py-2.5",
          shown && "border-b",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="min-w-0 flex-1 text-left"
          >
            {heading}
          </button>
        ) : (
          heading
        )}
        {action}
      </div>
      {shown && <div>{children}</div>}
    </section>
  )
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null)

/** A ChartBucket from a flat task list - the person view fetches once and derives. */
function bucketOf(tasks: DrillTask[]): ChartBucket {
  const b: ChartBucket = {
    assigned: tasks.length,
    completed: 0,
    inProgress: 0,
    onHold: 0,
    discarded: 0,
    overdue: 0,
    onTime: 0,
    late: 0,
    openTodo: 0,
    openProgress: 0,
    allocatedHours: 0,
    spentHours: 0,
    completionRate: null,
    onTimeRate: null,
  }
  for (const t of tasks) {
    b.allocatedHours += t.estimatedHours ?? 0
    b.spentHours += t.loggedHours
    const s = stateOfTask(t)
    if (s === "done") {
      b.completed++
      if (t.dueDate && t.completedAt) {
        if (new Date(t.completedAt) <= new Date(`${t.dueDate}T23:59:59.999Z`)) b.onTime++
        else b.late++
      }
    } else if (s === "hold") b.onHold++
    else if (s === "overdue") b.overdue++
    else if (s === "progress") b.openProgress++
    else if (s === "todo") b.openTodo++
    else b.discarded++
    if (t.status === "IN_PROGRESS") b.inProgress++
  }
  b.completionRate = pct(b.completed, b.assigned - b.discarded)
  b.onTimeRate = pct(b.onTime, b.onTime + b.late)
  return b
}

// ─────────────────────────────────────────────────────────────────────────────
// The four views
// ─────────────────────────────────────────────────────────────────────────────

function StateView({ d, push }: { d: Extract<Drill, { kind: "state" }>; push: Push }) {
  void push
  return (
    <TaskList
      filters={{
        state: d.state,
        projectId: d.projectId,
        assigneeId: d.assigneeId,
        teamId: d.teamId,
        from: d.range?.from,
        to: d.range?.to,
      }}
      groupBy={d.groupBy ?? (d.projectId ? "assignee" : "project")}
    />
  )
}

function ClientView({ d, push }: { d: Extract<Drill, { kind: "client" }>; push: Push }) {
  const [tab, setTab] = React.useState<ClientTab>(d.tab ?? "overview")
  const [state, setState] = React.useState<TaskState>(d.state ?? "all")
  const perf = usePerformance(d.project.id, d.range)
  const prog = useProjectProgress(d.project.id, d.range)
  const goals = useGoalsPortfolio(d.project.id)

  const s = perf.data?.summary
  const p = prog.data
  const goalRow: ProjectGoalsRow | undefined = goals.data?.projects[0]

  const openTasks = (st: TaskState) => {
    setState(st)
    setTab("tasks")
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTab)}>
      <div className="border-border/60 border-b px-5">
        <TabsList className="h-9 bg-transparent p-0">
          {(
            [
              ["overview", "Overview"],
              ["tasks", `Tasks${s ? ` (${s.assigned})` : ""}`],
              ["people", `People${perf.data ? ` (${perf.data.byEmployee.length})` : ""}`],
              ["goals", `Goals${goalRow ? ` (${goalRow.totalGoals})` : ""}`],
              ["hours", "Hours"],
            ] as [ClientTab, string][]
          ).map(([k, label]) => (
            <TabsTrigger
              key={k}
              value={k}
              className="data-[state=active]:border-foreground rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="overview" className="m-0 space-y-4 p-5">
        {!s || !p ? (
          <Skeleton className="h-64 rounded" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile
                icon={CheckCircle2}
                label="Completion"
                value={s.completionRate == null ? "–" : `${s.completionRate}%`}
                sub={`${s.completed} of ${s.assigned - s.discarded} tasks ${rangeLabel(d.range)}`}
                tone={
                  s.completionRate == null
                    ? "default"
                    : s.completionRate >= 70
                      ? "good"
                      : s.completionRate >= 40
                        ? "warn"
                        : "bad"
                }
              />
              <Tile
                icon={Clock}
                label="On time"
                value={s.onTimeRate == null ? "–" : `${s.onTimeRate}%`}
                sub={s.completed ? `${s.onTime} on time, ${s.late} late` : "nothing finished yet"}
                tone={s.onTimeRate == null ? "default" : s.onTimeRate >= 85 ? "good" : "warn"}
              />
              <Tile
                icon={AlertTriangle}
                label="Overdue"
                value={String(perf.data?.overdueNow ?? 0)}
                sub="as of today"
                tone={(perf.data?.overdueNow ?? 0) > 0 ? "bad" : "good"}
              />
              <Tile
                icon={Gauge}
                label="Hours"
                value={`${formatHours(s.spentHours)}`}
                sub={
                  s.allocatedHours > 0
                    ? `of ${formatHours(s.allocatedHours)} booked`
                    : "no estimate set"
                }
                tone={s.allocatedHours > 0 && s.spentHours > s.allocatedHours ? "warn" : "default"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Where the work stands" sub={`${rangeLabel(d.range)} · click a slice`}>
                <div className="p-3">
                  <StateDonut bucket={s} height={190} onPick={openTasks} />
                </div>
              </Section>
              <Section title="Pace" sub="Completed vs due, 8 weeks">
                <div className="p-3">
                  <PaceLine trend={perf.data?.trend ?? []} height={190} />
                </div>
              </Section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section
                title="Overdue now"
                sub="Open and past due, as of today"
                action={
                  <button
                    type="button"
                    onClick={() => openTasks("overdue")}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                  >
                    See all
                  </button>
                }
              >
                {/* A summary panel, capped: the full list is one click away on
                    the Tasks tab, and thirty rows here would bury Due next. */}
                <TaskList
                  filters={{ state: "overdue", projectId: d.project.id }}
                  groupBy="none"
                  showProject={false}
                  emptyTitle="Nothing overdue."
                  compact
                  limit={8}
                />
              </Section>
              <Section
                title="Due next"
                sub="Open work, soonest first"
                action={
                  <button
                    type="button"
                    onClick={() => openTasks("open")}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                  >
                    See all
                  </button>
                }
              >
                <ul className="divide-border/60 divide-y">
                  {p.upcoming
                    .filter((t) => !t.overdue)
                    .slice(0, 6)
                    .map((t) => (
                      <li key={t.id} className="flex items-center gap-2 px-4 py-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                        <span className="text-muted-foreground shrink-0">
                          {t.assigneeName ?? "Unassigned"}
                        </span>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatDate(t.dueDate)}
                        </span>
                      </li>
                    ))}
                  {p.upcoming.filter((t) => !t.overdue).length === 0 && (
                    <li className="text-muted-foreground px-4 py-4 text-center text-xs">
                      Nothing scheduled.
                    </li>
                  )}
                </ul>
              </Section>
            </div>

            {p.seo.length > 0 && (
              <Section
                title="Search performance"
                sub={
                  p.seoTotals
                    ? `${p.seoTotals.clicks.toLocaleString("en-IN")} clicks, ${p.seoTotals.impressions.toLocaleString("en-IN")} impressions across ${p.seo.length} site${p.seo.length === 1 ? "" : "s"} · latest synced week`
                    : undefined
                }
              >
                <div className="divide-border/60 divide-y">
                  {p.seo.map((site) => (
                    <SeoRow key={site.id} site={site} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="tasks" className="m-0">
        <div className="border-border/60 border-b px-5 py-3">
          <StateChips value={state} onChange={setState} />
        </div>
        {/* Edge to edge so the list's own sticky toolbar sits flush. */}
        <TaskList
          filters={{
            state,
            projectId: d.project.id,
            // "Overdue" is a today question everywhere on the page; the rest
            // follow the range the page was showing.
            from: state === "overdue" ? undefined : d.range?.from,
            to: state === "overdue" ? undefined : d.range?.to,
          }}
          groupBy="assignee"
          showProject={false}
        />
      </TabsContent>

      <TabsContent value="people" className="m-0 p-5">
        {!perf.data ? (
          <Skeleton className="h-48 rounded" />
        ) : (
          <Section title="By person" sub="Click a bar to open the person">
            <div className="p-3">
              <StateStack
                rows={perf.data.byEmployee
                  .map((r) => ({ ...r, states: statesOf(r) }))
                  .sort((a, b) => b.assigned - a.assigned)}
                height={Math.max(160, perf.data.byEmployee.length * 40)}
                onPick={(id, st) => {
                  const who = perf.data!.byEmployee.find((e) => e.id === id)
                  if (who) {
                    push({
                      kind: "person",
                      person: { id, name: who.name, profilePhoto: who.profilePhoto },
                      projectId: d.project.id,
                      state: st,
                      range: d.range,
                    })
                  }
                }}
              />
              <StateLegend />
            </div>
          </Section>
        )}
      </TabsContent>

      <TabsContent value="goals" className="m-0 p-5">
        {goals.isLoading ? (
          <Skeleton className="h-48 rounded" />
        ) : (
          <GoalsBody row={goalRow} project={d.project} />
        )}
      </TabsContent>

      <TabsContent value="hours" className="m-0 p-5">
        {!p ? (
          <Skeleton className="h-48 rounded" />
        ) : (
          <Section title="Hours by team" sub="Booked against spent, on tasks in this range">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground border-border/60 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Team</th>
                  <th className="px-4 py-2 text-right font-medium">Tasks</th>
                  <th className="px-4 py-2 text-right font-medium">Done</th>
                  <th className="px-4 py-2 text-right font-medium">Booked</th>
                  <th className="px-4 py-2 text-right font-medium">Spent</th>
                  <th className="w-40 px-4 py-2 text-left font-medium">Drift</th>
                </tr>
              </thead>
              <tbody className="divide-border/60 divide-y">
                {p.byTeam.map((t) => {
                  const over = t.estimatedHours > 0 && t.loggedHours > t.estimatedHours
                  const w =
                    t.estimatedHours > 0
                      ? Math.min(100, (t.loggedHours / t.estimatedHours) * 100)
                      : 0
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-medium">
                        {t.name}
                        {t.members > 0 && (
                          <span className="text-muted-foreground ml-1.5 font-normal">
                            {t.members} member{t.members === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.done}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatHours(t.estimatedHours)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2 text-right tabular-nums",
                          over && "text-amber-500",
                        )}
                      >
                        {formatHours(t.loggedHours)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              over ? "bg-amber-500" : "bg-primary",
                            )}
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {p.byTeam.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-6 text-center">
                      No teams yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        )}
      </TabsContent>
    </Tabs>
  )
}

function PersonView({ d }: { d: Extract<Drill, { kind: "person" }> }) {
  const [state, setState] = React.useState<TaskState>(d.state ?? "all")
  const { data, isLoading } = useTaskList({
    state: "all",
    assigneeId: d.person.id,
    projectId: d.projectId,
    from: d.range?.from,
    to: d.range?.to,
  })
  // Memoised so the derived bucket and chip counts below only recompute when
  // the response changes, not on every render of a filter chip.
  const tasks = React.useMemo(() => data?.data ?? [], [data])
  const b = React.useMemo(() => bucketOf(tasks), [tasks])
  const counts = React.useMemo(() => {
    const c: Partial<Record<TaskState, number>> = { all: tasks.length }
    for (const chip of STATE_CHIPS) {
      if (chip.key !== "all") c[chip.key] = tasks.filter((t) => matchesState(t, chip.key)).length
    }
    return c
  }, [tasks])

  if (isLoading) return <Skeleton className="m-5 h-64 rounded" />

  return (
    <div className="space-y-4 p-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          icon={CheckCircle2}
          label="Completion"
          value={b.completionRate == null ? "–" : `${b.completionRate}%`}
          sub={`${b.completed} of ${b.assigned - b.discarded} tasks`}
          tone={
            b.completionRate == null
              ? "default"
              : b.completionRate >= 70
                ? "good"
                : b.completionRate >= 40
                  ? "warn"
                  : "bad"
          }
        />
        <Tile
          icon={Clock}
          label="On time"
          value={b.onTimeRate == null ? "–" : `${b.onTimeRate}%`}
          sub={
            b.onTime + b.late > 0 ? `${b.onTime} on time, ${b.late} late` : "nothing dated finished"
          }
          tone={b.onTimeRate == null ? "default" : b.onTimeRate >= 85 ? "good" : "warn"}
        />
        <Tile
          icon={AlertTriangle}
          label="Overdue"
          value={String(b.overdue)}
          sub="open and past due"
          tone={b.overdue > 0 ? "bad" : "good"}
        />
        <Tile
          icon={Gauge}
          label="Hours"
          value={formatHours(b.spentHours)}
          sub={b.allocatedHours > 0 ? `of ${formatHours(b.allocatedHours)} booked` : "no estimates"}
          tone={b.allocatedHours > 0 && b.spentHours > b.allocatedHours ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Section title="Their mix" sub="Click a slice to filter">
          <div className="p-3">
            <StateDonut bucket={b} height={170} onPick={(s) => setState(s)} />
          </div>
        </Section>
        <div className="space-y-3">
          <StateChips value={state} onChange={setState} counts={counts} />
          <div className="border-border/60 overflow-hidden rounded-[6px] border">
            <TaskRows
              tasks={tasks.filter((t) => matchesState(t, state))}
              groupBy={d.projectId ? "none" : "project"}
              showProject={!d.projectId}
              showAssignee={false}
              emptyTitle="Nothing in this state."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function GoalsBody({ row, project }: { row?: ProjectGoalsRow; project: DrillProject }) {
  const href = projectHref({ id: project.id, slug: project.slug ?? row?.projectSlug }, "goals")
  if (!row || row.totalGoals === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        No goals set on this project.{" "}
        <Link href={href} className="hover:text-foreground underline underline-offset-4">
          Set one
        </Link>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Tile label="Overall" value={`${row.overallProgress}%`} />
        <Tile label="Done" value={`${row.doneGoals} / ${row.totalGoals}`} />
        <Tile
          label="At risk"
          value={String(row.atRiskGoals)}
          tone={row.atRiskGoals ? "warn" : "default"}
        />
        <Tile
          label="Overdue"
          value={String(row.overdueGoals)}
          tone={row.overdueGoals ? "bad" : "default"}
        />
        <Tile
          label="Next target"
          value={row.nextTargetDate ? fmtDate(row.nextTargetDate) : "None"}
        />
      </div>
      <Section
        title="Goals"
        sub="As of today"
        action={
          <Link
            href={href}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] underline underline-offset-4"
          >
            Edit on the Goals tab <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="p-4">
          <GoalTree goals={row.goals} />
        </div>
      </Section>
    </div>
  )
}

function GoalsView({ d, push }: { d: Extract<Drill, { kind: "goals" }>; push: Push }) {
  const { data, isLoading } = useGoalsPortfolio(d.projectId)
  if (isLoading || !data) return <Skeleton className="m-5 h-64 rounded" />

  if (d.projectId) {
    const row = data.projects[0]
    return (
      <div className="p-5">
        <GoalsBody
          row={row}
          project={{
            id: d.projectId,
            name: row?.projectName ?? "",
            code: row?.projectCode,
            slug: row?.projectSlug,
          }}
        />
      </div>
    )
  }

  const withGoals = data.projects.filter((p) => p.totalGoals > 0)
  return (
    <div className="space-y-4 p-5">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Tile
          label="Overall"
          value={`${data.totals.overallProgress}%`}
          sub={`across ${data.totals.projectsWithGoals} projects`}
        />
        <Tile label="Done" value={`${data.totals.doneGoals} / ${data.totals.totalGoals}`} />
        <Tile
          label="At risk"
          value={String(data.totals.atRiskGoals)}
          tone={data.totals.atRiskGoals ? "warn" : "default"}
        />
        <Tile
          label="Overdue"
          value={String(data.totals.overdueGoals)}
          tone={data.totals.overdueGoals ? "bad" : "default"}
        />
        <Tile
          label="Next target"
          value={data.totals.nextTargetDate ? fmtDate(data.totals.nextTargetDate) : "None"}
        />
      </div>
      {withGoals.map((row) => (
        <Section
          key={row.projectId}
          collapsible
          title={row.projectName}
          sub={`${row.overallProgress}% · ${row.doneGoals} of ${row.totalGoals} done${row.overdueGoals ? ` · ${row.overdueGoals} overdue` : ""}${row.atRiskGoals ? ` · ${row.atRiskGoals} at risk` : ""}`}
          action={
            <button
              type="button"
              onClick={() =>
                push({
                  kind: "client",
                  project: {
                    id: row.projectId,
                    name: row.projectName,
                    code: row.projectCode,
                    slug: row.projectSlug,
                  },
                  tab: "goals",
                })
              }
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11px] underline underline-offset-4"
            >
              Open client <ArrowUpRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="p-4">
            <GoalTree goals={row.goals} />
          </div>
        </Section>
      ))}
      {withGoals.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">No goals set anywhere yet.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The shell
// ─────────────────────────────────────────────────────────────────────────────

type Push = (d: Drill) => void

function Header({ d }: { d: Drill }) {
  switch (d.kind) {
    case "state":
      return (
        <div>
          <DialogTitle className="text-base">{d.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {d.subtitle ?? rangeLabel(d.range)}
          </DialogDescription>
        </div>
      )
    case "client":
      return (
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="truncate">{d.project.name}</span>
              {d.project.code && (
                <span className="text-muted-foreground font-mono text-[11px] font-normal">
                  {d.project.code}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tasks {rangeLabel(d.range)} · overdue and goals as of today
            </DialogDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1.5">
            <Link href={projectHref({ id: d.project.id, slug: d.project.slug })}>
              Open project <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )
    case "person":
      return (
        <div className="flex items-center gap-3">
          <AvatarDisplay
            src={d.person.profilePhoto ?? null}
            firstName={d.person.name.split(" ")[0] ?? ""}
            lastName={d.person.name.split(" ").slice(1).join(" ")}
            size="sm"
          />
          <div>
            <DialogTitle className="text-base">{d.person.name}</DialogTitle>
            <DialogDescription className="text-xs">
              {d.projectId ? "On this project" : "Across every project"} · tasks{" "}
              {rangeLabel(d.range)}
            </DialogDescription>
          </div>
        </div>
      )
    case "goals":
      return (
        <div>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Goals
          </DialogTitle>
          <DialogDescription className="text-xs">
            {d.projectId ? "This project" : "Every project you can see"} · as of today
          </DialogDescription>
        </div>
      )
  }
}

function Body({ d, push }: { d: Drill; push: Push }) {
  switch (d.kind) {
    case "state":
      // Edge to edge, no padding: the list's toolbar is sticky and has to sit
      // flush with the top of the scroll area to stay under your hand.
      return <StateView d={d} push={push} />
    case "client":
      return <ClientView d={d} push={push} />
    case "person":
      return <PersonView d={d} />
    case "goals":
      return <GoalsView d={d} push={push} />
  }
}

/**
 * Mounted fresh per root drill (the parent keys it), so the stack seeds from
 * props with no effect and no stale content from the last thing opened.
 */
function DrillStack({ root }: { root: Drill }) {
  const [stack, setStack] = React.useState<Drill[]>([root])
  const current = stack[stack.length - 1]!
  const push: Push = (d) => setStack((s) => [...s, d])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))

  return (
    <>
      <div className="border-border/60 flex items-center gap-3 border-b px-5 py-3 pr-12">
        {stack.length > 1 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={back}
            aria-label="Back"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        {/* keyed so a push re-renders the header for the NEW view, not a stale one */}
        <div className="min-w-0 flex-1" key={stack.length}>
          <Header d={current} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div key={stack.length}>
          <Body d={current} push={push} />
        </div>
      </div>
    </>
  )
}

export function ProgressDrilldown({
  drill,
  onClose,
}: {
  drill: Drill | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(drill)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {drill && <DrillStack key={JSON.stringify(drill)} root={drill} />}
      </DialogContent>
    </Dialog>
  )
}
