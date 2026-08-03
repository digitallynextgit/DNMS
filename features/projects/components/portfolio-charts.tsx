"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { ListChecks } from "lucide-react"

// =============================================================================
// Portfolio charts: the "All projects" view.
//
// Three questions, three forms:
//   1. What is the work made of?      -> donut (part-to-whole, 5 slices)
//   2. Which project carries it?      -> stacked bar, done vs pending
//   3. Who is delivering efficiently? -> bar, completion rate per person
//
// Colours: the donut uses the app's STATUS palette (the same greens/ambers/reds
// the status badges use) because those slices are states, and every slice is
// labelled so hue never carries meaning alone. The stacked bar uses the two
// validated categorical slots, in fixed order.
// =============================================================================

const AXIS = "var(--viz-axis)"
const GRID = "var(--viz-grid)"
const SERIES_1 = "var(--viz-1)"
const SERIES_2 = "var(--viz-2)"

/** Matches the status badge colours used across the app. */
const STATUS = {
  done: "#10b981",
  inProgress: "#3b82f6",
  todo: "#94a3b8",
  onHold: "#f59e0b",
  discarded: "#f87171",
}

export interface ChartBucket {
  assigned: number
  completed: number
  inProgress: number
  onHold: number
  discarded: number
  overdue: number
  completionRate: number | null
  onTimeRate: number | null
}

export interface ChartRow extends ChartBucket {
  id: string
  name: string
}

function Tip({ rows, title }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-popover rounded border p-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="text-muted-foreground flex items-center gap-3">
          <span>{r.label}</span>
          <span className="text-foreground ml-auto font-medium tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
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

  const todo =
    summary.assigned - summary.completed - summary.inProgress - summary.onHold - summary.discarded

  const mix = [
    { name: "Done", value: summary.completed, fill: STATUS.done },
    { name: "In progress", value: summary.inProgress, fill: STATUS.inProgress },
    { name: "To do", value: Math.max(0, todo), fill: STATUS.todo },
    { name: "On hold", value: summary.onHold, fill: STATUS.onHold },
    { name: "Discarded", value: summary.discarded, fill: STATUS.discarded },
  ].filter((s) => s.value > 0)

  // Busiest first; the bar is done-vs-pending so the split is visible per project.
  const projRows = [...projects]
    .map((p) => ({
      ...p,
      pending: p.assigned - p.completed - p.discarded,
    }))
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 10)

  // Only people with finished work have a meaningful rate; the rest would read
  // as 0% failure when the honest answer is "not measured yet".
  const effRows = [...people]
    .filter((p) => p.completionRate != null)
    .sort((a, b) => (b.completionRate ?? 0) - (a.completionRate ?? 0))
    .slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* What the work is made of */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">What the work is made of</p>
            <p className="text-muted-foreground mb-2 text-xs">
              {summary.assigned} tasks across every project
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {mix.map((s) => (
                    <Cell key={s.name} fill={s.fill} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  formatter={(v) => <span className="text-muted-foreground text-xs">{v}</span>}
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <Tip
                        title={String(payload[0]!.name)}
                        rows={[
                          { label: "Tasks", value: String(payload[0]!.value) },
                          {
                            label: "Share",
                            value: `${Math.round((Number(payload[0]!.value) / summary.assigned) * 100)}%`,
                          },
                        ]}
                      />
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Where it sits */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Done vs pending, by project</p>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES_1 }} />
                Done
              </span>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES_2 }} />
                Pending
              </span>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(200, projRows.length * 30)}>
              <BarChart
                data={projRows}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
                barCategoryGap={6}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={104}
                />
                <Tooltip
                  cursor={{ fill: GRID, fillOpacity: 0.25 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <Tip
                        title={String(payload[0]!.payload.name)}
                        rows={[
                          { label: "Done", value: String(payload[0]!.payload.completed) },
                          { label: "Pending", value: String(payload[0]!.payload.pending) },
                          { label: "Overdue", value: String(payload[0]!.payload.overdue) },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar dataKey="completed" stackId="a" fill={SERIES_1} maxBarSize={16} />
                <Bar
                  dataKey="pending"
                  stackId="a"
                  fill={SERIES_2}
                  maxBarSize={16}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Who is delivering */}
      {effRows.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium">Completion rate by person</p>
            <p className="text-muted-foreground mb-2 text-xs">
              Done ÷ assigned, excluding discarded. Only people with finished work appear.
            </p>
            <ResponsiveContainer width="100%" height={Math.max(200, effRows.length * 30)}>
              <BarChart
                data={effRows}
                layout="vertical"
                margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
                barCategoryGap={6}
              >
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  unit="%"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: AXIS, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={128}
                />
                <Tooltip
                  cursor={{ fill: GRID, fillOpacity: 0.25 }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <Tip
                        title={String(payload[0]!.payload.name)}
                        rows={[
                          {
                            label: "Completion",
                            value: `${payload[0]!.payload.completionRate ?? 0}%`,
                          },
                          {
                            label: "On time",
                            value:
                              payload[0]!.payload.onTimeRate == null
                                ? "no data"
                                : `${payload[0]!.payload.onTimeRate}%`,
                          },
                          { label: "Done", value: String(payload[0]!.payload.completed) },
                          { label: "Overdue", value: String(payload[0]!.payload.overdue) },
                        ]}
                      />
                    ) : null
                  }
                />
                <Bar dataKey="completionRate" fill={SERIES_1} maxBarSize={14} radius={[0, 4, 4, 0]}>
                  {effRows.map((r) => (
                    <Cell key={r.id} fill={SERIES_1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
