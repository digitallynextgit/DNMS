"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo, PauseCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { apiFetch } from "@/lib/api-fetch"
import { cn, formatDate } from "@/lib/utils"
import { TASK_PRIORITY_COLORS, TASK_PRIORITY_LABELS } from "@/lib/constants"
import { formatHours } from "../lib/format-hours"
import { projectHref } from "../lib/project-href"
import { ADHOC_LABEL, ADHOC_ROW_ID } from "../lib/task-permissions"
import { DateRangePicker, type DayRange } from "./date-range-picker"

// =============================================================================
// My Progress.
//
// Four questions, four forms:
//   1. What state is my work in?      -> donut (part-to-whole, mutually exclusive)
//   2. Which client carries it?       -> horizontal stacked bar, one row per client
//   3. Am I booking time realistically? -> grouped bar, allocated vs spent
//   4. What exactly is late?          -> a list, because you have to act on each one
//
// Colour: every fill is a STATE, so all of them come from the --state-* tokens
// (validated as an ordered set, see globals.css) rather than the categorical
// slots - a series colour must never impersonate a status. The only categorical
// pair on the page is allocated-vs-spent, which uses --viz-1/--viz-2.
//
// Three of the state fills sit under 3:1 on the light card, so every chart here
// carries a legend AND direct labels: hue never carries meaning on its own.
// =============================================================================

interface MyTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  completedAt: string | null
  estimatedHours: number | null
  loggedHours: number
  /**
   * NULL for adhoc work - meetings, interviews, internal QC - which belongs to
   * no client. The API has always been able to return null.
   */
  project: { id: string; name: string; code: string; slug: string | null } | null
  team?: { id: string; name: string } | null
}

/**
 * The five states a task can be counted in. MUTUALLY EXCLUSIVE on purpose:
 * "overdue" is not a status but a late To-do or In-progress, so a chart that
 * showed both would count those tasks twice and the parts would not sum to the
 * whole. Overdue wins, because that is the one demanding attention.
 */
type State = "overdue" | "todo" | "hold" | "progress" | "done"

/** Fixed order - it is the CVD mechanism for the fills. See globals.css. */
const STATES: { key: State; label: string; fill: string; icon: typeof ListTodo }[] = [
  { key: "overdue", label: "Overdue", fill: "var(--state-overdue)", icon: AlertTriangle },
  { key: "todo", label: "To do", fill: "var(--state-todo)", icon: ListTodo },
  { key: "hold", label: "On hold", fill: "var(--state-hold)", icon: PauseCircle },
  { key: "progress", label: "In progress", fill: "var(--state-progress)", icon: CircleDot },
  { key: "done", label: "Done", fill: "var(--state-done)", icon: CheckCircle2 },
]

/** Local calendar day, so "due today" is not late because of a UTC boundary. */
function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Which bucket a task falls in.
 *
 * Overdue = past its due day AND still actionable. A task due Tuesday that is
 * still To-do or In-progress on Wednesday is overdue; the same task on hold or
 * discarded is NOT - it was consciously parked, which is a decision rather than
 * a slip, and flagging it red would train people to ignore the colour.
 */
function stateOf(task: MyTask, today: number): State | null {
  if (task.status === "DONE") return "done"
  if (task.status === "DISCARDED" || task.status === "CANCELLED") return null
  if (task.status === "ON_HOLD") return "hold"
  const late = task.dueDate && dayStart(new Date(task.dueDate)) < today
  if (late) return "overdue"
  if (task.status === "IN_PROGRESS" || task.status === "IN_REVIEW") return "progress"
  return "todo"
}

// ─── Date range ───────────────────────────────────────────────────────────────

type PresetKey = "week" | "month" | "30d" | "all"
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
]

function presetRange(key: PresetKey): { from: number; to: number } | null {
  if (key === "all") return null
  const now = new Date()
  const today = dayStart(now)
  if (key === "30d") return { from: today - 29 * 86_400_000, to: today }
  if (key === "month") {
    return { from: dayStart(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
  }
  // Week runs Mon-Sun, matching the allocation sheet.
  const dow = (now.getDay() + 6) % 7
  return { from: today - dow * 86_400_000, to: today + (6 - dow) * 86_400_000 }
}

function customRange(range: DayRange): { from: number; to: number } {
  const [fy, fm, fd] = range.from.split("-").map(Number)
  const [ty, tm, td] = range.to.split("-").map(Number)
  return {
    from: new Date(fy!, fm! - 1, fd!).getTime(),
    to: new Date(ty!, tm! - 1, td!).getTime(),
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyProgress() {
  // Shares the ["my-tasks"] cache entry with the My Tasks page, so it must cache
  // the SAME shape: the `{ data }` envelope, not the unwrapped array.
  const { data, isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => apiFetch<{ data: MyTask[] }>("/api/tasks?mine=true"),
    staleTime: 30_000,
  })

  const [preset, setPreset] = useState<PresetKey>("all")
  const [custom, setCustom] = useState<DayRange | undefined>()

  const tasks = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data])

  const view = useMemo(() => {
    const today = dayStart(new Date())
    const range = custom ? customRange(custom) : presetRange(preset)

    // Filtered on the DUE day - the day the work was planned for, which is what
    // the range picker is asking about. Undated tasks cannot answer that
    // question, so they are excluded and counted separately rather than
    // silently landing in whatever range happens to be selected.
    const undated = range ? tasks.filter((t) => !t.dueDate).length : 0
    const inRange = range
      ? tasks.filter((t) => {
          if (!t.dueDate) return false
          const d = dayStart(new Date(t.dueDate))
          return d >= range.from && d <= range.to
        })
      : tasks

    const counts: Record<State, number> = { overdue: 0, todo: 0, hold: 0, progress: 0, done: 0 }
    const byProject = new Map<
      string,
      {
        id: string
        name: string
        slug: string | null
        counts: Record<State, number>
        total: number
      }
    >()
    const hours = new Map<string, { id: string; name: string; allocated: number; spent: number }>()

    for (const t of inRange) {
      const state = stateOf(t, today)
      if (!state) continue
      counts[state]++

      const key = t.project?.id ?? ADHOC_ROW_ID
      const name = t.project?.name ?? ADHOC_LABEL
      const p = byProject.get(key) ?? {
        id: key,
        name,
        slug: t.project?.slug ?? null,
        counts: { overdue: 0, todo: 0, hold: 0, progress: 0, done: 0 } as Record<State, number>,
        total: 0,
      }
      p.counts[state]++
      p.total++
      byProject.set(key, p)

      const h = hours.get(key) ?? { id: key, name, allocated: 0, spent: 0 }
      h.allocated += t.estimatedHours ?? 0
      h.spent += t.loggedHours
      hours.set(key, h)
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return {
      counts,
      total,
      undated,
      overdueTasks: inRange
        .filter((t) => stateOf(t, today) === "overdue")
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
      byProject: [...byProject.values()].sort((a, b) => b.total - a.total),
      hours: [...hours.values()]
        .filter((h) => h.allocated > 0 || h.spent > 0)
        .sort((a, b) => b.allocated - a.allocated),
      rangeLabel: custom
        ? `${formatDate(custom.from)} - ${formatDate(custom.to)}`
        : (PRESETS.find((p) => p.key === preset)?.label ?? "All time"),
    }
  }, [tasks, preset, custom])

  if (isLoading) return <Skeleton className="h-96 rounded" />

  const donut = STATES.map((s) => ({ ...s, value: view.counts[s.key] })).filter((d) => d.value > 0)
  const completion = view.total > 0 ? Math.round((view.counts.done / view.total) * 100) : null

  return (
    <div className="space-y-4">
      {/* Filters in ONE row above the charts, so the whole page reads as being
          about the selected period. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-card inline-flex items-center rounded-[2px] border p-0.5 text-xs">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPreset(p.key)
                setCustom(undefined)
              }}
              className={cn(
                "rounded-[2px] px-2.5 py-1 font-medium transition-colors",
                !custom && preset === p.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <DateRangePicker value={custom} onChange={setCustom} onClear={() => setCustom(undefined)} />
        {view.undated > 0 && (
          <span className="text-muted-foreground text-xs">
            {view.undated} undated task{view.undated === 1 ? "" : "s"} not shown
          </span>
        )}
      </div>

      {view.total === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Nothing in this period"
          description="No tasks are due in the selected range. Try a wider range."
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 1. What state is my work in? */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Where my work stands
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    {view.rangeLabel}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={donut}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={62}
                        outerRadius={92}
                        // 2px of surface between slices, so adjacent fills never
                        // touch - the gap does work that hue alone should not.
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donut.map((d) => (
                          <Cell key={d.key} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<StateTooltip total={view.total} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* The headline lives in the hole rather than as a separate
                      tile - one number, where the eye already is. */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{view.total}</span>
                    <span className="text-muted-foreground text-[11px]">tasks</span>
                    {completion != null && (
                      <span className="text-muted-foreground text-[11px]">{completion}% done</span>
                    )}
                  </div>
                </div>

                {/* Legend + direct values. Required, not decorative: three of
                    these fills are under 3:1 on the light card. */}
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {STATES.map((s) => {
                    const Icon = s.icon
                    return (
                      <div key={s.key} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ background: s.fill }}
                        />
                        <Icon className="text-muted-foreground h-3 w-3 shrink-0" />
                        <span className="text-muted-foreground truncate">{s.label}</span>
                        <span className="ml-auto font-medium tabular-nums">
                          {view.counts[s.key]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 2. Which client carries it? */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tasks by client</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, view.byProject.length * 42)}
                >
                  <BarChart
                    data={view.byProject}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                    barCategoryGap="22%"
                  >
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      stroke="var(--viz-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    {/* Horizontal because client names are long - rotated labels
                        are the usual reason a bar chart becomes unreadable. */}
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      stroke="var(--viz-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={9} />
                    {STATES.map((s) => (
                      <Bar
                        key={s.key}
                        dataKey={`counts.${s.key}`}
                        name={s.label}
                        stackId="a"
                        fill={s.fill}
                        // 2px surface gap between stacked segments.
                        stroke="var(--card)"
                        strokeWidth={2}
                        radius={2}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* The chart's table twin. Not optional decoration: segment
                    values otherwise exist only inside a tooltip, and three of
                    these fills sit under 3:1 on the light card - so the numbers
                    have to be readable without relying on hue or hover. */}
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="py-1 text-left font-normal">Client</th>
                        {STATES.map((s) => (
                          <th key={s.key} className="py-1 pl-2 text-right font-normal">
                            {s.label}
                          </th>
                        ))}
                        <th className="py-1 pl-2 text-right font-medium">All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.byProject.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="max-w-[9rem] truncate py-1">
                            {p.id === ADHOC_ROW_ID ? (
                              <span className="text-muted-foreground">{p.name}</span>
                            ) : (
                              <Link
                                href={projectHref({ id: p.id, slug: p.slug })}
                                className="hover:underline"
                              >
                                {p.name}
                              </Link>
                            )}
                          </td>
                          {STATES.map((s) => (
                            <td
                              key={s.key}
                              className={cn(
                                "py-1 pl-2 text-right tabular-nums",
                                p.counts[s.key] === 0 && "text-muted-foreground/40",
                              )}
                            >
                              {p.counts[s.key]}
                            </td>
                          ))}
                          <td className="py-1 pl-2 text-right font-medium tabular-nums">
                            {p.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3. Am I booking time realistically? */}
          {view.hours.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Hours booked vs spent
                  <span className="text-muted-foreground ml-2 text-xs font-normal">per client</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, view.hours.length * 44)}>
                  <BarChart
                    data={view.hours}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
                    barGap={2}
                  >
                    <XAxis
                      type="number"
                      stroke="var(--viz-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => `${v}h`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      stroke="var(--viz-axis)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }}
                      content={<HoursTooltip />}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={9} />
                    {/* The one CATEGORICAL pair on the page - two measures of the
                        same unit on one axis, so no second scale is needed. */}
                    <Bar dataKey="allocated" name="Booked" fill="var(--viz-1)" radius={2} />
                    <Bar dataKey="spent" name="Spent" fill="var(--viz-2)" radius={2} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 4. What exactly is late? A chart cannot answer this - you have to
              act on each row, so it is a list. */}
          {view.overdueTasks.length > 0 && (
            <Card className="border-l-2" style={{ borderLeftColor: "var(--state-overdue)" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4" style={{ color: "var(--state-overdue)" }} />
                  Overdue ({view.overdueTasks.length})
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  Past their due day and still to do or in progress. Work on hold or discarded is
                  not counted - that was a decision, not a slip.
                </p>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {view.overdueTasks.map((t) => (
                  <TaskRow key={t.id} t={t} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

/** Slice tooltip: name, count and share, so the donut is readable without maths. */
function StateTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean
  payload?: { name?: string; value?: number }[]
  total: number
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]!
  const value = p.value ?? 0
  return (
    <div className="bg-card rounded-[2px] border px-2 py-1 text-xs shadow-sm">
      <span className="font-medium">{p.name}</span>
      <span className="text-muted-foreground ml-2 tabular-nums">
        {value} · {total > 0 ? Math.round((value / total) * 100) : 0}%
      </span>
    </div>
  )
}

/** Booked vs spent for one client, as hours rather than raw decimals. */
function HoursTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card rounded-[2px] border px-2 py-1.5 text-xs shadow-sm">
      <p className="mb-0.5 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-[1px]" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{formatHours(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  )
}

/** One overdue task - what it is, whose it is, and how late. */
function TaskRow({ t }: { t: MyTask }) {
  const daysLate = t.dueDate
    ? Math.round((dayStart(new Date()) - dayStart(new Date(t.dueDate))) / 86_400_000)
    : 0
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{t.title}</p>
        {t.project ? (
          <Link
            href={projectHref(t.project)}
            className="text-muted-foreground hover:text-foreground truncate text-[11px] hover:underline"
          >
            {t.project.name}
            {t.team ? ` · ${t.team.name}` : ""}
          </Link>
        ) : (
          <span className="text-muted-foreground truncate text-[11px]">{ADHOC_LABEL}</span>
        )}
      </div>

      <StatusBadge
        status={t.priority}
        colorMap={TASK_PRIORITY_COLORS}
        labelMap={TASK_PRIORITY_LABELS}
        size="xs"
      />

      {t.estimatedHours != null && t.estimatedHours > 0 && (
        <span className="text-muted-foreground hidden shrink-0 tabular-nums sm:inline">
          {formatHours(t.estimatedHours)}
        </span>
      )}

      <Badge
        variant="outline"
        className="shrink-0 gap-1 border-red-300 py-0 text-[10px] text-red-600"
      >
        <AlertTriangle className="h-3 w-3" />
        {daysLate === 0 ? "today" : `${daysLate}d late`}
      </Badge>
    </div>
  )
}
