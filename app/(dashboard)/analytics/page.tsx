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
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

// Charts are code-split: recharts only downloads once the analytics data is in.
const AnalyticsCharts = dynamic(
  () => import("@/features/analytics/components/analytics-charts").then((m) => m.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
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
            <Skeleton key={i} className="h-64 rounded-lg" />
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
          description={`${d.employees.active} active`}
          icon={Users}
          trend={{ value: hireDelta, label: "vs last month" }}
        />
        <StatCard
          title="New Hires This Month"
          value={d.employees.newThisMonth}
          description={`${d.employees.newLastMonth} last month`}
          icon={UserCheck}
        />
        <StatCard
          title="Open Jobs"
          value={d.recruitment.openJobs}
          description={`${d.recruitment.applicantsThisMonth} applicants this month`}
          icon={Briefcase}
        />
        <StatCard
          title="Active Projects"
          value={d.projects.active}
          description={`${d.projects.tasksCompletedThisMonth} tasks completed this month`}
          icon={FolderOpen}
        />
        <StatCard
          title="Pending Leaves"
          value={d.leave.pending}
          description={`${d.leave.approvedThisMonth} approved this month`}
          icon={Clock}
        />
        <StatCard
          title="Attendance This Month"
          value={d.attendance["PRESENT"] ?? 0}
          description={`${d.attendance["ABSENT"] ?? 0} absent · ${d.attendance["HALF_DAY"] ?? 0} half-day`}
          icon={CheckSquare}
        />
        {d.payroll && (
          <StatCard
            title="Last Payroll Net"
            value={formatCurrency(d.payroll.totalNet)}
            description={`${d.payroll.periodLabel} · ${d.payroll.count} slips`}
            icon={TrendingUp}
          />
        )}
        <StatCard
          title="Departments"
          value={d.departments.length}
          description="across organisation"
          icon={Building2}
        />
      </div>

      {/* Charts (lazy-loaded) */}
      <AnalyticsCharts d={d} />
    </div>
  )
}
