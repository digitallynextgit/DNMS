"use client"

// Lazy-loaded by the Analytics page (next/dynamic) so heavy recharts doesn't delay the KPI cards.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { APPLICANT_STAGE_LABELS } from "@/lib/constants"
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from "@/lib/chart-theme"

const DEPT_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
]
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#22c55e",
  ON_LEAVE: "#f97316",
  TERMINATED: "#ef4444",
  PROBATION: "#eab308",
}

export interface AnalyticsChartsData {
  departments: { name: string; count: number }[]
  /** People working here with no department set. */
  unassigned?: number
  recruitment: { byStage: { stage: string; count: number }[] }
  trends: { hires: { month: string; count: number }[] }
  statusDistribution: { status: string; count: number }[]
}

export function AnalyticsCharts({ d }: { d: AnalyticsChartsData }) {
  // Every department with someone in it (biggest first), and the people with none.
  const headcount = [
    ...d.departments.filter((x) => x.count > 0),
    ...(d.unassigned ? [{ name: "No department", count: d.unassigned }] : []),
  ]
  const people = headcount.reduce((s, x) => s + x.count, 0)
  const staffed = d.departments.filter((x) => x.count > 0).length
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Monthly Hires (6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={d.trends.hires} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              />
              <Bar dataKey="count" name="Hires" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Department Headcount</CardTitle>
          <p className="text-muted-foreground text-xs">
            {people} people working now, across {staffed} department{staffed === 1 ? "" : "s"}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(220, headcount.length * 30 + 30)}>
            <BarChart
              data={headcount}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={130}
                interval={0}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              />
              <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}>
                {headcount.map((_, index) => (
                  <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
                <LabelList dataKey="count" position="right" className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Employee Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={d.statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="count"
                nameKey="status"
              >
                {d.statusDistribution.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={STATUS_COLORS[entry.status] ?? DEPT_COLORS[index % DEPT_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  value,
                  String(name).charAt(0) + String(name).slice(1).toLowerCase().replace(/_/g, " "),
                ]}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              />
              <Legend
                formatter={(value) =>
                  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ")
                }
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recruitment Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          {d.recruitment.byStage.length === 0 ? (
            <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
              No applicants yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={d.recruitment.byStage.map((s) => ({
                  name: APPLICANT_STAGE_LABELS[s.stage] ?? s.stage,
                  count: s.count,
                }))}
                margin={{ top: 4, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey="count" name="Applicants" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
