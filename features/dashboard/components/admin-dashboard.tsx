"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useQuery } from "@tanstack/react-query"
import { Users, UserPlus, FileText, Bell, UserCircle, Upload, ClipboardList } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { formatDate } from "@/lib/utils"

// Charts are code-split: recharts only downloads once the dashboard data is in.
const DepartmentPieChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.DepartmentPieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)
const EmployeeStatusBarChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.EmployeeStatusBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

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

export function AdminDashboard() {
  const { data, isLoading, isError, error } = useQuery<DashboardStats, Error>({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <>
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
              <DepartmentPieChart data={data?.employees.byDepartment ?? []} />
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
              <EmployeeStatusBarChart data={data?.employees.byStatus ?? []} />
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
              <ListSkeleton rows={5} height="h-12" className="px-5 pb-4" />
            ) : !data?.recentJoiners.length ? (
              <EmptyState title="No recent joiners found." compact />
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
    </>
  )
}
