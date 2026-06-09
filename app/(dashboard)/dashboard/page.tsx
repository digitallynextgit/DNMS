"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Users, UserPlus, FileText, Bell, UserCircle, Upload, ClipboardList } from "lucide-react"
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { formatDate } from "@/lib/utils"
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants"

interface DashboardStats {
  employees: {
    total: number
    newThisMonth: number
    byStatus: { status: string; count: number }[]
    byDepartment: { department: string; count: number }[]
  }
  documents: { total: number }
  notifications: { unread: number }
  recentJoiners: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    designation: { title: string } | null
    department: { name: string } | null
    dateOfJoining: string | null
    profilePhoto: string | null
  }[]
}

const DEPT_COLORS = [
  "hsl(var(--foreground))",
  "hsl(var(--muted-foreground))",
  "#555",
  "#888",
  "#aaa",
  "#333",
  "#777",
]

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? "Failed to load dashboard stats")
  }
  return res.json()
}

function StatCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-[var(--radius)] border p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-4 w-4 shrink-0" />
      </div>
    </div>
  )
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-muted w-full animate-pulse rounded-[var(--radius)]" style={{ height }} />
  )
}

export default function DashboardPage() {
  const today = new Date()
  const dateString = today.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const { data, isLoading, isError, error } = useQuery<DashboardStats, Error>({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={dateString} />

      {isError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-[var(--radius)] border px-4 py-3 text-sm">
          {error?.message ?? "Something went wrong loading the dashboard."}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Employees"
              value={data?.employees.total ?? 0}
              description="Active headcount"
              icon={Users}
            />
            <StatCard
              title="New This Month"
              value={data?.employees.newThisMonth ?? 0}
              description="Joined in last 30 days"
              icon={UserPlus}
            />
            <StatCard
              title="Total Documents"
              value={data?.documents.total ?? 0}
              description="Uploaded documents"
              icon={FileText}
            />
            <StatCard
              title="Unread Notifications"
              value={data?.notifications.unread ?? 0}
              description="Pending notifications"
              icon={Bell}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Department Headcount
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data?.employees.byDepartment ?? []}
                    dataKey="count"
                    nameKey="department"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {(data?.employees.byDepartment ?? []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value, name) => [
                      `${Number(value)} employee${Number(value) !== 1 ? "s" : ""}`,
                      String(name ?? ""),
                    ]}
                    contentStyle={{
                      borderRadius: "var(--radius)",
                      fontSize: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Employee Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={(data?.employees.byStatus ?? []).map((s) => ({
                    status: EMPLOYEE_STATUS_LABELS[s.status] ?? s.status,
                    count: s.count,
                  }))}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
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
                    contentStyle={{
                      borderRadius: "var(--radius)",
                      fontSize: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--foreground))"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Recent Joiners
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0 px-5 pb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-border flex items-center gap-3 border-b py-3 last:border-0"
                  >
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : !data?.recentJoiners.length ? (
              <p className="text-muted-foreground px-5 pb-5 text-sm">No recent joiners found.</p>
            ) : (
              <div className="divide-border divide-y">
                {data.recentJoiners.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                    <AvatarDisplay
                      src={emp.profilePhoto}
                      firstName={emp.firstName}
                      lastName={emp.lastName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {emp.designation?.title ?? "-"}
                        {emp.department?.name ? ` · ${emp.department.name}` : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(emp.dateOfJoining)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="h-9 w-full justify-start gap-2 text-sm">
              <Link href="/employees/new">
                <UserCircle className="text-muted-foreground h-4 w-4" />
                <span>Add New Employee</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-9 w-full justify-start gap-2 text-sm">
              <Link href="/documents">
                <Upload className="text-muted-foreground h-4 w-4" />
                <span>Upload Document</span>
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-9 w-full justify-start gap-2 text-sm">
              <Link href="/admin/audit-log">
                <ClipboardList className="text-muted-foreground h-4 w-4" />
                <span>View Audit Log</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
