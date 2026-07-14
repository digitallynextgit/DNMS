"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Laptop,
  Bell,
  Plus,
  CalendarOff,
  ArrowRight,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { LeaveBalanceCard } from "@/features/leave"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PAYROLL_STATUS_LABELS } from "@/lib/constants"
import type { LeaveBalance } from "@/features/leave"

interface EmployeeDashboardData {
  employee: {
    firstName: string
    lastName: string
    dateOfJoining: string | null
    designation: { title: string } | null
    department: { name: string } | null
    manager: { firstName: string; lastName: string } | null
  } | null
  attendance: {
    present: number
    absent: number
    halfDay: number
    onLeave: number
    avgHours: number
    month: string
  }
  leaveBalances: LeaveBalance[]
  totalLeaveAvailable: number
  latestPayslip: {
    id: string
    month: number
    year: number
    netSalary: number
    status: string
    paidAt: string | null
  } | null
  pending: { leave: number; wfh: number }
  upcomingHolidays: { id: string; name: string; date: string; isOptional: boolean }[]
  notifications: { unread: number }
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

async function fetchEmployeeDashboard(): Promise<EmployeeDashboardData> {
  const res = await fetch("/api/dashboard/me")
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? "Failed to load your dashboard")
  }
  return res.json()
}

function StatCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border p-5">
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

export function EmployeeDashboard() {
  const { data, isLoading, isError, error } = useQuery<EmployeeDashboardData, Error>({
    queryKey: ["dashboard-me"],
    queryFn: fetchEmployeeDashboard,
    staleTime: 2 * 60 * 1000,
  })

  const pendingTotal = (data?.pending.leave ?? 0) + (data?.pending.wfh ?? 0)

  return (
    <>
      {isError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error?.message ?? "Something went wrong loading your dashboard."}
        </div>
      )}

      {/* Summary stat cards */}
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
              title="Present This Month"
              value={data?.attendance.present ?? 0}
              description={`Avg ${data?.attendance.avgHours ?? 0}h / working day`}
              icon={CheckCircle2}
            />
            <StatCard
              title="Leave Available"
              value={data?.totalLeaveAvailable ?? 0}
              description="Days across all types"
              icon={CalendarDays}
            />
            <StatCard
              title="Pending Requests"
              value={pendingTotal}
              description={`${data?.pending.leave ?? 0} leave · ${data?.pending.wfh ?? 0} WFH`}
              icon={Clock}
            />
            <StatCard
              title="Unread Notifications"
              value={data?.notifications.unread ?? 0}
              description="In your inbox"
              icon={Bell}
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Button asChild variant="outline" className="h-9 justify-start gap-2 text-sm">
          <Link href="/leave/apply">
            <Plus className="text-muted-foreground h-4 w-4" />
            <span>Apply Leave</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 justify-start gap-2 text-sm">
          <Link href="/wfh/apply">
            <Laptop className="text-muted-foreground h-4 w-4" />
            <span>Apply WFH</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 justify-start gap-2 text-sm">
          <Link href="/attendance/me">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span>My Attendance</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 justify-start gap-2 text-sm">
          <Link href="/payroll/me">
            <DollarSign className="text-muted-foreground h-4 w-4" />
            <span>My Payslips</span>
          </Link>
        </Button>
      </div>

      {/* Leave balances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
            My Leave Balances
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Link href="/leave">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : !data?.leaveBalances.length ? (
            <EmptyState
              title="No leave balances allocated yet. Contact HR to set up your balances."
              compact
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.leaveBalances.map((balance) => (
                <LeaveBalanceCard key={balance.id} balance={balance} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Latest payslip */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Latest Payslip
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Link href="/payroll/me">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 rounded-lg" />
            ) : !data?.latestPayslip ? (
              <EmptyState title="No payslips available yet." compact />
            ) : (
              <Link
                href="/payroll/me"
                className="hover:bg-muted/30 -m-2 flex items-center justify-between rounded-lg p-2 transition-colors"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {MONTH_NAMES[data.latestPayslip.month - 1]} {data.latestPayslip.year}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {PAYROLL_STATUS_LABELS[data.latestPayslip.status] ?? data.latestPayslip.status}
                    {data.latestPayslip.paidAt
                      ? ` · Paid ${formatDate(data.latestPayslip.paidAt)}`
                      : ""}
                  </p>
                </div>
                <p className="text-foreground text-lg font-semibold">
                  {formatCurrency(data.latestPayslip.netSalary)}
                </p>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Upcoming holidays */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Upcoming Holidays
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Link href="/holiday-calendar">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <ListSkeleton rows={4} height="h-10" className="px-5 pb-4" />
            ) : !data?.upcomingHolidays.length ? (
              <EmptyState title="No upcoming holidays." compact />
            ) : (
              <div className="divide-border divide-y">
                {data.upcomingHolidays.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                    <CalendarOff className="text-muted-foreground h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">{h.name}</p>
                      {h.isOptional && (
                        <p className="text-muted-foreground text-xs">Floating / optional</p>
                      )}
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatDate(h.date, "EEE, dd MMM")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
