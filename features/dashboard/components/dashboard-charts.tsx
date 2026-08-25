"use client"

// Recharts is heavy (~100kB+). Keeping these charts in their own module lets the
// dashboard lazy-load them (next/dynamic) so the landing page's initial JS stays
// small and the stat cards paint immediately.
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import {
  CHART_NEUTRAL_SERIES,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from "@/lib/chart-theme"

const DEPT_COLORS = CHART_NEUTRAL_SERIES

export function DepartmentPieChart({ data }: { data: { department: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="department"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
          ))}
        </Pie>
        <RechartsTooltip
          formatter={(value, name) => [
            `${Number(value)} employee${Number(value) !== 1 ? "s" : ""}`,
            String(name ?? ""),
          ]}
          contentStyle={CHART_TOOLTIP_STYLE}
          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
        />
        <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function EmployeeStatusBarChart({ data }: { data: { status: string; count: number }[] }) {
  const rows = data.map((s) => ({
    status: EMPLOYEE_STATUS_LABELS[s.status] ?? s.status,
    count: s.count,
  }))
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="status"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <RechartsTooltip
          cursor={false}
          formatter={(value) => [
            `${Number(value)} employee${Number(value) !== 1 ? "s" : ""}`,
            "Count",
          ]}
          contentStyle={CHART_TOOLTIP_STYLE}
          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
        />
        <Bar dataKey="count" fill="hsl(var(--foreground))" radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
