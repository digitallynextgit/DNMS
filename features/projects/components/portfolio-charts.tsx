"use client"

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
import { formatHours } from "../lib/format-hours"

// =============================================================================
// Portfolio charts: what the person running the place needs to see.
//
// Five questions, five forms:
//   1. What state is the portfolio in?   -> donut (part-to-whole, exclusive)
//   2. Which client is at risk?          -> stacked bar by state, per project
//   3. Who is carrying what?             -> stacked bar by state, per person
//   4. Do we finish on time?             -> on-time vs late, per person
//   5. Do we estimate honestly?          -> booked vs spent hours, per project
//
// Colour: states use the --state-* tokens, validated as an ORDERED set in both
// modes (see globals.css) and shared with My Progress, so a colour means the
// same thing on both pages. Booked-vs-spent is the one categorical pair and
// uses --viz-1/--viz-2 - a series colour never impersonates a state.
//
// Three state fills sit under 3:1 on the light card, so every chart carries a
// legend and the numbers are readable without hover.
// =============================================================================

type State = "overdue" | "todo" | "hold" | "progress" | "done"

/** Fixed order - it IS the CVD mechanism for these fills. Never reorder alone. */
const STATES: { key: State; label: string; fill: string; icon: typeof ListTodo }[] = [
  { key: "overdue", label: "Overdue", fill: "var(--state-overdue)", icon: AlertTriangle },
  { key: "todo", label: "To do", fill: "var(--state-todo)", icon: ListTodo },
  { key: "hold", label: "On hold", fill: "var(--state-hold)", icon: PauseCircle },
  { key: "progress", label: "In progress", fill: "var(--state-progress)", icon: CircleDot },
  { key: "done", label: "Done", fill: "var(--state-done)", icon: CheckCircle2 },
]

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

/** The five exclusive states for one bucket, ready to stack. */
function statesOf(b: ChartBucket): Record<State, number> {
  return {
    overdue: b.overdue,
    todo: b.openTodo,
    hold: b.onHold,
    progress: b.openProgress,
    done: b.completed,
  }
}

function Tip({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
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

/** Shared legend. Required, not decorative - see the palette note above. */
function StateLegend({ counts }: { counts?: Record<State, number> }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
      {STATES.map((s) => {
        const Icon = s.icon
        return (
          <span key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.fill }} />
            <Icon className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="text-muted-foreground">{s.label}</span>
            {counts && <span className="font-medium tabular-nums">{counts[s.key]}</span>}
          </span>
        )
      })}
    </div>
  )
}

/** A horizontal stacked-by-state bar chart. Used for both projects and people. */
function StateStack({
  rows,
  height,
}: {
  rows: (ChartRow & { states: Record<State, number> })[]
  height: number
}) {
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
        {/* Horizontal: client and people names are long, and rotated tick labels
            are the usual reason a bar chart stops being readable. */}
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
                rows={payload
                  .filter((p) => Number(p.value) > 0)
                  .map((p) => ({ label: String(p.name), value: String(p.value) }))}
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
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function PortfolioCharts({
  summary,
  projects,
  people,
}: {
  summary: ChartBucket
  projects: ChartRow[]
  people: ChartRow[]
}) {
  if (summary.assigned === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState icon={ListChecks} compact title="No task data yet." />
        </CardContent>
      </Card>
    )
  }

  const counts = statesOf(summary)
  const mixTotal = Object.values(counts).reduce((a, b) => a + b, 0)
  const mix = STATES.map((s) => ({ ...s, value: counts[s.key] })).filter((s) => s.value > 0)

  // Busiest first, capped at 10: past that the rows get too thin to read and the
  // tail is better served by the per-project page.
  const projRows = [...projects]
    .map((p) => ({ ...p, states: statesOf(p) }))
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 10)

  const peopleRows = [...people]
    .map((p) => ({ ...p, states: statesOf(p) }))
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 10)

  // Only people who have FINISHED something have a meaningful on-time record;
  // the rest would read as 0% failure when the honest answer is "not measured".
  const timeliness = [...people]
    .filter((p) => p.completed > 0)
    .sort((a, b) => (b.onTimeRate ?? 0) - (a.onTimeRate ?? 0))
    .slice(0, 10)

  const hourRows = [...projects]
    .filter((p) => p.allocatedHours > 0 || p.spentHours > 0)
    .sort((a, b) => b.allocatedHours - a.allocatedHours)
    .slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. What state is the portfolio in? */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Where the portfolio stands</p>
            <p className="text-muted-foreground mb-1 text-xs">
              {mixTotal} live tasks
              {summary.discarded > 0 && ` · ${summary.discarded} discarded, not counted`}
            </p>
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={mix}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                    strokeWidth={0}
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
                              value: `${Math.round((Number(payload[0]!.value) / mixTotal) * 100)}%`,
                            },
                          ]}
                        />
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* The headline sits in the hole - one number, where the eye is. */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{summary.completionRate ?? 0}%</span>
                <span className="text-muted-foreground text-[11px]">complete</span>
              </div>
            </div>
            <StateLegend counts={counts} />
          </CardContent>
        </Card>

        {/* 2. Which client is at risk? */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Tasks by client</p>
            <p className="text-muted-foreground mb-2 text-xs">
              Busiest first{projects.length > 10 && ` · top 10 of ${projects.length}`}
            </p>
            <StateStack rows={projRows} height={Math.max(200, projRows.length * 40)} />
            <StateLegend />
          </CardContent>
        </Card>

        {/* 3. Who is carrying what? */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Load by person</p>
            <p className="text-muted-foreground mb-2 text-xs">
              Who is holding the overdue work{people.length > 10 && ` · top 10 of ${people.length}`}
            </p>
            <StateStack rows={peopleRows} height={Math.max(200, peopleRows.length * 40)} />
            <StateLegend />
          </CardContent>
        </Card>

        {/* 4. Do we finish on time? */}
        {timeliness.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium">Delivered on time</p>
              <p className="text-muted-foreground mb-2 text-xs">
                Of work actually completed - people with nothing finished are left out
              </p>
              <ResponsiveContainer width="100%" height={Math.max(200, timeliness.length * 40)}>
                <BarChart
                  data={timeliness}
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
                            { label: "On time", value: String(payload[0]?.value ?? 0) },
                            { label: "Late", value: String(payload[1]?.value ?? 0) },
                          ]}
                        />
                      ) : null
                    }
                  />
                  {/* Done-green for on time, overdue-red for late: the same two
                      colours those states carry everywhere else on the page. */}
                  <Bar
                    dataKey="onTime"
                    name="On time"
                    stackId="a"
                    fill="var(--state-done)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={2}
                  />
                  <Bar
                    dataKey="late"
                    name="Late"
                    stackId="a"
                    fill="var(--state-overdue)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    radius={2}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: "var(--state-done)" }}
                  />
                  <CheckCircle2 className="text-muted-foreground h-3 w-3" />
                  <span className="text-muted-foreground">On time</span>
                  <span className="font-medium tabular-nums">{summary.onTime}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ background: "var(--state-overdue)" }}
                  />
                  <AlertTriangle className="text-muted-foreground h-3 w-3" />
                  <span className="text-muted-foreground">Late</span>
                  <span className="font-medium tabular-nums">{summary.late}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 5. Do we estimate honestly? */}
      {hourRows.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Hours booked vs spent</p>
            <p className="text-muted-foreground mb-2 text-xs">
              Where the estimates are drifting · {formatHours(summary.allocatedHours)} booked,{" "}
              {formatHours(summary.spentHours)} spent
            </p>
            <ResponsiveContainer width="100%" height={Math.max(200, hourRows.length * 42)}>
              <BarChart
                data={hourRows}
                layout="vertical"
                margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
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
                        rows={payload.map((p) => ({
                          label: String(p.name),
                          value: formatHours(Number(p.value ?? 0)),
                        }))}
                      />
                    ) : null
                  }
                />
                {/* The one CATEGORICAL pair on the page: two measures of the same
                    unit, so they share one axis and need no second scale. */}
                <Bar dataKey="allocatedHours" name="Booked" fill="var(--viz-1)" radius={2} />
                <Bar dataKey="spentHours" name="Spent" fill="var(--viz-2)" radius={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={9} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* The table twin. Segment values otherwise live only in a tooltip, and
          three of these fills are under 3:1 on the light card. */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">Every client, in numbers</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="py-1 text-left font-normal">Client</th>
                  {STATES.map((s) => (
                    <th key={s.key} className="py-1 pl-2 text-right font-normal">
                      {s.label}
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right font-normal">Booked</th>
                  <th className="py-1 pl-2 text-right font-normal">Spent</th>
                  <th className="py-1 pl-2 text-right font-medium">All</th>
                </tr>
              </thead>
              <tbody>
                {[...projects]
                  .sort((a, b) => b.assigned - a.assigned)
                  .map((p) => {
                    const st = statesOf(p)
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="max-w-36 truncate py-1">{p.name}</td>
                        {STATES.map((s) => (
                          <td
                            key={s.key}
                            className={cn(
                              "py-1 pl-2 text-right tabular-nums",
                              st[s.key] === 0 && "text-muted-foreground/40",
                            )}
                          >
                            {st[s.key]}
                          </td>
                        ))}
                        <td className="text-muted-foreground py-1 pl-2 text-right tabular-nums">
                          {formatHours(p.allocatedHours)}
                        </td>
                        <td className="text-muted-foreground py-1 pl-2 text-right tabular-nums">
                          {formatHours(p.spentHours)}
                        </td>
                        <td className="py-1 pl-2 text-right font-medium tabular-nums">
                          {p.assigned}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
