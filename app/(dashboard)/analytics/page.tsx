"use client"

import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import {
  Users,
  UserCheck,
  Briefcase,
  TrendingUp,
  FolderOpen,
  CheckSquare,
  Building2,
  Clock,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, cn } from "@/lib/utils"

// Charts are code-split: recharts only downloads once the analytics data is in.
const AnalyticsCharts = dynamic(
  () => import("@/features/analytics/components/analytics-charts").then((m) => m.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded" />
        ))}
      </div>
    ),
  },
)

interface AnalyticsData {
  employees: { total: number; active: number; newThisMonth: number; newLastMonth: number }
  departments: { name: string; count: number }[]
  leave: { pending: number; approvedThisMonth: number }
  attendance: Record<string, number>
  payroll: {
    totalGross: number
    totalNet: number
    periodLabel: string
    count: number
  } | null
  recruitment: {
    openJobs: number
    applicantsThisMonth: number
    byStage: { stage: string; count: number }[]
  }
  projects: { active: number; tasksCompletedThisMonth: number }
  trends: { hires: { month: string; count: number }[] }
  statusDistribution: { status: string; count: number }[]
}

async function fetchAnalytics(): Promise<{ data: AnalyticsData }> {
  const res = await fetch("/api/analytics")
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
}: {
  title: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: { value: number; label: string }
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="mt-1 text-3xl font-bold">{value}</p>
            {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
            {trend && (
              <p
                className={cn(
                  "mt-1 text-xs font-medium",
                  trend.value >= 0 ? "text-emerald-600" : "text-red-500",
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value} {trend.label}
              </p>
            )}
          </div>
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded">
            <Icon className="text-primary h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 60000,
  })
  const d = data?.data

  if (isLoading)
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Executive dashboard and reporting" />
        <CardGridSkeleton count={8} />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded" />
          ))}
        </div>
      </div>
    )

  if (!d) return null

  const hireDelta = d.employees.newThisMonth - d.employees.newLastMonth

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Executive dashboard and reporting" />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={d.employees.total}
          sub={`${d.employees.active} active`}
          icon={Users}
          trend={{ value: hireDelta, label: "vs last month" }}
        />
        <StatCard
          title="New Hires This Month"
          value={d.employees.newThisMonth}
          sub={`${d.employees.newLastMonth} last month`}
          icon={UserCheck}
        />
        <StatCard
          title="Open Jobs"
          value={d.recruitment.openJobs}
          sub={`${d.recruitment.applicantsThisMonth} applicants this month`}
          icon={Briefcase}
        />
        <StatCard
          title="Active Projects"
          value={d.projects.active}
          sub={`${d.projects.tasksCompletedThisMonth} tasks completed this month`}
          icon={FolderOpen}
        />
        <StatCard
          title="Pending Leaves"
          value={d.leave.pending}
          sub={`${d.leave.approvedThisMonth} approved this month`}
          icon={Clock}
        />
        <StatCard
          title="Attendance This Month"
          value={d.attendance["PRESENT"] ?? 0}
          sub={`${d.attendance["ABSENT"] ?? 0} absent · ${d.attendance["HALF_DAY"] ?? 0} half-day`}
          icon={CheckSquare}
        />
        {d.payroll && (
          <StatCard
            title="Last Payroll Net"
            value={formatCurrency(d.payroll.totalNet)}
            sub={`${d.payroll.periodLabel} · ${d.payroll.count} slips`}
            icon={TrendingUp}
          />
        )}
        <StatCard
          title="Departments"
          value={d.departments.length}
          sub="across organisation"
          icon={Building2}
        />
      </div>

      {/* Charts (lazy-loaded) */}
      <AnalyticsCharts d={d} />
    </div>
  )
}
