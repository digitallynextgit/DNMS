"use client"

// Recharts is heavy; this whole charts grid is lazy-loaded by the Analytics page
// (next/dynamic) so the KPI cards paint immediately and recharts only downloads
// once the analytics data is ready.
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
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { APPLICANT_STAGE_LABELS } from "@/lib/constants"

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
  recruitment: { byStage: { stage: string; count: number }[] }
  trends: { hires: { month: string; count: number }[] }
  statusDistribution: { status: string; count: number }[]
}

export function AnalyticsCharts({ d }: { d: AnalyticsChartsData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Hire trend */}
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
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="Hires" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Department headcount */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Headcount by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={d.departments.slice(0, 8)}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}>
                {d.departments.slice(0, 8).map((_, index) => (
                  <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Employee status donut */}
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
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
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

      {/* Applicants by stage */}
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
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Applicants" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
