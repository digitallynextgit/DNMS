"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ListChecks,
  ListTodo,
  PauseCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

// =============================================================================
// The charts on the Progress page, and the primitives the drill-downs reuse.
//
// Four questions, four forms, all clickable:
//   1. What state is the work in?     -> donut (part-to-whole, exclusive states)
//   2. Which client / team is at risk? -> stacked bar by state, one row each
//   3. Who is carrying what?           -> stacked bar by state, one row each
//   4. Is the pace holding?            -> line, completed vs due, 8 weeks
//
// EVERY MARK IS A DOOR. A slice opens the tasks in that state; a bar opens the
// client or person it names, on the segment's state. The old page drew the
// same counts three ways and none of them went anywhere, which is how a
// dashboard turns into a report. The click is the feature; the chart is how
// you find the click.
//
// Colour: states use the --state-* tokens, validated as an ORDERED set in both
// themes (see globals.css). The pace line is the one categorical pair and uses
// --viz-1/--viz-2 - a series colour never impersonates a state.
//
// Three state fills sit under 3:1 on the light card, so every chart carries a
// legend with counts and the numbers are readable without hover.
// =============================================================================

export type State = "overdue" | "todo" | "hold" | "progress" | "done"

/** Fixed order - it IS the CVD mechanism for these fills. Never reorder alone. */
export const STATES: { key: State; label: string; fill: string; icon: typeof ListTodo }[] = [
  { key: "overdue", label: "Overdue", fill: "var(--state-overdue)", icon: AlertTriangle },
  { key: "todo", label: "To do", fill: "var(--state-todo)", icon: ListTodo },
  { key: "hold", label: "On hold", fill: "var(--state-hold)", icon: PauseCircle },
  { key: "progress", label: "In progress", fill: "var(--state-progress)", icon: CircleDot },
  { key: "done", label: "Done", fill: "var(--state-done)", icon: CheckCircle2 },
]

export const STATE_LABEL: Record<State, string> = Object.fromEntries(
  STATES.map((s) => [s.key, s.label]),
) as Record<State, string>

export interface ChartBucket {
  assigned: number
  completed: number
  inProgress: number
  onHold: number
  discarded: number
  overdue: number
  onTime: number
  late: number
  openTodo: number
  openProgress: number
  allocatedHours: number
  spentHours: number
  completionRate: number | null
  onTimeRate: number | null
}

export interface ChartRow extends ChartBucket {
  id: string
  name: string
}

/** The five exclusive states for one bucket, ready to stack or slice. */
export function statesOf(b: ChartBucket): Record<State, number> {
  return {
    overdue: b.overdue,
    todo: b.openTodo,
    hold: b.onHold,
    progress: b.openProgress,
    done: b.completed,
  }
}

export function Tip({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-card rounded-[2px] border px-2 py-1.5 text-xs shadow-sm">
      <p className="mb-0.5 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="text-muted-foreground flex items-center gap-3">
          <span>{r.label}</span>
          <span className="text-foreground ml-auto font-medium tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Shared legend. Required, not decorative - see the palette note above. With
 * `onPick` each entry is a button, which is also the keyboard route to a slice.
 */
export function StateLegend({
  counts,
  onPick,
  active,
}: {
  counts?: Record<State, number>
  onPick?: (state: State) => void
  active?: State | null
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
      {STATES.map((s) => {
        const Icon = s.icon
        const inner = (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.fill }} />
            <Icon className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground">{s.label}</span>
            {counts && <span className="font-medium tabular-nums">{counts[s.key]}</span>}
          </>
        )
        if (!onPick) {
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-xs">
              {inner}
            </span>
          )
        }
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s.key)}
            className={cn(
              "hover:bg-muted flex items-center gap-1.5 rounded-[2px] px-1.5 py-0.5 text-xs transition-colors",
              active === s.key && "bg-muted",
            )}
          >
            {inner}
          </button>
        )
      })}
    </div>
  )
}

/** Recharts hands click handlers a sector/rect whose datum sits on `.payload`. */
const datumOf = <T,>(d: unknown): T | undefined =>
  (d as { payload?: T } | undefined)?.payload ?? (d as T | undefined)

/**
 * The state mix as a donut, with the headline in the hole.
 *
 * Only states with a count are drawn - an empty slice is a 0px gap - but the
 * legend still lists all five with their counts, so "no overdue" is a visible
 * zero rather than an absence someone has to notice.
 */
export function StateDonut({
  bucket,
  centre,
  height = 220,
  onPick,
}: {
  bucket: ChartBucket
  /** What sits in the hole. Defaults to the completion rate. */
  centre?: { value: string; label: string }
  height?: number
  onPick?: (state: State) => void
}) {
  const counts = statesOf(bucket)
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const mix = STATES.map((s) => ({ ...s, value: counts[s.key] })).filter((s) => s.value > 0)
  const hole = centre ?? { value: `${bucket.completionRate ?? 0}%`, label: "complete" }

  if (total === 0) {
    return <EmptyState icon={ListChecks} compact title="Nothing to show for this scope." />
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={mix}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              strokeWidth={0}
              onClick={(d: unknown) => {
                const key = datumOf<{ key: State }>(d)?.key
                if (key && onPick) onPick(key)
              }}
              style={onPick ? { cursor: "pointer" } : undefined}
            >
              {mix.map((s) => (
                <Cell key={s.key} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <Tip
                    title={String(payload[0]!.name)}
                    rows={[
                      { label: "Tasks", value: String(payload[0]!.value) },
                      {
                        label: "Share",
                        value: `${Math.round((Number(payload[0]!.value) / total) * 100)}%`,
                      },
                      ...(onPick ? [{ label: "Click", value: "to list them" }] : []),
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{hole.value}</span>
          <span className="text-muted-foreground text-[11px]">{hole.label}</span>
        </div>
      </div>
      <StateLegend counts={counts} onPick={onPick} />
    </div>
  )
}

/**
 * A horizontal stacked-by-state bar chart, one row per client, team or person.
 *
 * Horizontal because the names are long, and rotated tick labels are the usual
 * reason a bar chart stops being readable. Clicking a segment reports the row
 * AND the state, so "the red part of KYG" opens KYG's overdue tasks, not just
 * KYG.
 */
export function StateStack({
  rows,
  height,
  onPick,
}: {
  rows: (ChartRow & { states: Record<State, number> })[]
  height: number
  onPick?: (rowId: string, state: State) => void
}) {
  if (rows.length === 0) {
    return <EmptyState icon={ListChecks} compact title="Nothing to show for this scope." />
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
        barCategoryGap="24%"
      >
        <XAxis
          type="number"
          allowDecimals={false}
          stroke="var(--viz-axis)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={116}
          stroke="var(--viz-axis)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                rows={[
                  ...payload
                    .filter((p) => Number(p.value) > 0)
                    .map((p) => ({ label: String(p.name), value: String(p.value) })),
                  ...(onPick ? [{ label: "Click", value: "to open" }] : []),
                ]}
              />
            ) : null
          }
        />
        {STATES.map((s) => (
          <Bar
            key={s.key}
            dataKey={`states.${s.key}`}
            name={s.label}
            stackId="a"
            fill={s.fill}
            // 2px of surface between segments, so adjacent fills never touch.
            stroke="var(--card)"
            strokeWidth={2}
            radius={2}
            style={onPick ? { cursor: "pointer" } : undefined}
            onClick={(d: unknown) => {
              const row = datumOf<ChartRow>(d)
              if (row?.id && onPick) onPick(row.id, s.key)
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Completed vs due, per Monday-start week. Two series of the same unit on one
 * axis - never a second scale - with the legend inline in the title row.
 */
export function PaceLine({
  trend,
  height = 200,
}: {
  trend: { weekStart: string; completed: number; due: number }[]
  height?: number
}) {
  const data = trend.map((w) => ({
    ...w,
    label: new Date(`${w.weekStart}T00:00:00.000Z`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
  }))
  if (!data.some((w) => w.completed > 0 || w.due > 0)) {
    return <EmptyState icon={ListChecks} compact title="No dated work in the last 8 weeks." />
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-end gap-3">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <span className="h-0.5 w-3 rounded-[2px]" style={{ background: "var(--viz-1)" }} />
          Completed
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
          <span className="h-0.5 w-3 rounded-[2px]" style={{ background: "var(--viz-2)" }} />
          Due
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="var(--viz-grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--viz-axis)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--viz-grid)" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--viz-axis)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: "var(--viz-grid)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <Tip
                  title={`Week of ${label}`}
                  rows={payload.map((p) => ({ label: String(p.name), value: String(p.value) }))}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="var(--viz-1)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--viz-1)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="due"
            name="Due"
            stroke="var(--viz-2)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={{ r: 3, strokeWidth: 0, fill: "var(--viz-2)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartCard({
  title,
  sub,
  children,
}: {
  title: string
  sub?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium">{title}</p>
        {sub && <p className="text-muted-foreground mb-2 text-xs">{sub}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

const withStates = (rows: ChartRow[]) =>
  [...rows]
    .map((r) => ({ ...r, states: statesOf(r) }))
    .sort((a, b) => b.assigned - a.assigned)
    // Past ten the rows get too thin to read; the table twin in the drill-down
    // carries the tail.
    .slice(0, 10)

/**
 * The 2x2 on the Progress page.
 *
 * `mode` decides the second card: across the portfolio it is one bar per
 * CLIENT; inside one project a single bar would say nothing, so it becomes one
 * bar per TEAM instead.
 */
export function PortfolioCharts({
  summary,
  scopeLabel,
  projects,
  teams,
  people,
  trend,
  mode,
  onState,
  onClient,
  onTeam,
  onPerson,
}: {
  summary: ChartBucket
  /** e.g. "due 31 Aug – 6 Sep" - what the donut is a donut OF. */
  scopeLabel: string
  projects: ChartRow[]
  teams?: ChartRow[]
  people: ChartRow[]
  trend: { weekStart: string; completed: number; due: number }[]
  mode: "portfolio" | "project"
  onState: (state: State) => void
  onClient: (projectId: string, state: State) => void
  onTeam: (teamId: string, state: State) => void
  onPerson: (employeeId: string, state: State) => void
}) {
  const live = Object.values(statesOf(summary)).reduce((a, b) => a + b, 0)
  const rowsA = mode === "portfolio" ? withStates(projects) : withStates(teams ?? [])
  const rowsB = withStates(people)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Where the work stands"
        sub={`${live} live tasks ${scopeLabel}${summary.discarded > 0 ? ` · ${summary.discarded} discarded, not counted` : ""} · click a slice`}
      >
        <StateDonut bucket={summary} onPick={onState} />
      </ChartCard>

      <ChartCard
        title={mode === "portfolio" ? "By client" : "By team"}
        sub={
          mode === "portfolio"
            ? `Busiest first${projects.length > 10 ? ` · top 10 of ${projects.length}` : ""} · click a bar to open the client`
            : "Click a bar to list that team's tasks"
        }
      >
        <StateStack
          rows={rowsA}
          height={Math.max(180, rowsA.length * 40)}
          onPick={mode === "portfolio" ? onClient : onTeam}
        />
        <StateLegend />
      </ChartCard>

      <ChartCard
        title="By person"
        sub={`Who is holding the overdue work${people.length > 10 ? ` · top 10 of ${people.length}` : ""} · click a bar to open the person`}
      >
        <StateStack rows={rowsB} height={Math.max(180, rowsB.length * 40)} onPick={onPerson} />
        <StateLegend />
      </ChartCard>

      <ChartCard title="Pace" sub="Completed vs due, last 8 weeks · not narrowed by the date range">
        <PaceLine trend={trend} />
      </ChartCard>
    </div>
  )
}
