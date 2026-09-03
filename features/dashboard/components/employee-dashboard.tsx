"use client"

import { Link } from "@/components/tenant-link"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  DollarSign,
  Laptop,
  ListTodo,
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
// From the module, not the projects barrel: the barrel re-exports every project
// COMPONENT, and this is a client bundle that has no use for any of them.
import { formatHours } from "@/features/projects/lib/format-hours"
import { cn, formatCurrency, formatDate } from "@/lib/utils"
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
  work: {
    counts: {
      open: number
      dueToday: number
      overdue: number
      running: number
      onHold: number
      doneThisWeek: number
    }
    week: { allocated: number; spent: number }
    today: DashTask[]
    running: DashTask[]
    projects: { id: string; name: string; slug: string | null; open: number; overdue: number }[]
  }
}

interface DashTask {
  id: string
  title: string
  status: string
  priority: string
  dueDate: string | null
  estimatedHours: number | null
  loggedHours: number
  inProgressSince: string | null
  project: { id: string; name: string; slug: string | null } | null
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

export function EmployeeDashboard() {
  const { data, isLoading, isError, error } = useQuery<EmployeeDashboardData, Error>({
    queryKey: ["dashboard-me"],
    queryFn: fetchEmployeeDashboard,
    staleTime: 2 * 60 * 1000,
  })

  const pendingTotal = (data?.pending.leave ?? 0) + (data?.pending.wfh ?? 0)
  const work = data?.work

  return (
    <>
      {isError && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-sm border px-4 py-3 text-sm">
          {error?.message ?? "Something went wrong loading your dashboard."}
        </div>
      )}

      {/* Work first, then HR. An employee opens this page to answer "what am I
          supposed to be doing", and the panel used to answer only "how much
          leave do I have" - true, but not the question. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard
          title="Due Today"
          value={work?.counts.dueToday ?? 0}
          description={work ? `${work.counts.open} open in total` : undefined}
          icon={ListTodo}
          loading={isLoading}
        />
        <StatCard
          title="Overdue"
          value={work?.counts.overdue ?? 0}
          description="Past due, still open"
          icon={AlertTriangle}
          iconColor={work && work.counts.overdue > 0 ? "text-red-500" : undefined}
          loading={isLoading}
        />
        <StatCard
          title="In Progress"
          value={work?.counts.running ?? 0}
          description={work && work.counts.running > 0 ? "clock running" : "nothing started"}
          icon={CircleDot}
          iconColor={work && work.counts.running > 0 ? "text-blue-500" : undefined}
          loading={isLoading}
        />
        <StatCard
          title="Present This Month"
          value={data?.attendance.present ?? 0}
          description={`Avg ${data?.attendance.avgHours ?? 0}h / day`}
          icon={CheckCircle2}
          loading={isLoading}
        />
        <StatCard
          title="Leave Available"
          value={data?.totalLeaveAvailable ?? 0}
          description="Days, all types"
          icon={CalendarDays}
          loading={isLoading}
        />
        <StatCard
          title="Pending Requests"
          value={pendingTotal}
          description={`${data?.pending.leave ?? 0} leave · ${data?.pending.wfh ?? 0} WFH`}
          icon={Clock}
          loading={isLoading}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Button asChild variant="outline" className="h-9 min-w-0 justify-start gap-2 text-sm">
          <Link href="/projects/my-tasks">
            <ListTodo className="text-muted-foreground h-4 w-4" />
            <span className="truncate">My Tasks</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 min-w-0 justify-start gap-2 text-sm">
          <Link href="/leave/apply">
            <Plus className="text-muted-foreground h-4 w-4" />
            <span className="truncate">Apply Leave</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 min-w-0 justify-start gap-2 text-sm">
          <Link href="/wfh/apply">
            <Laptop className="text-muted-foreground h-4 w-4" />
            <span className="truncate">Apply WFH</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 min-w-0 justify-start gap-2 text-sm">
          <Link href="/attendance/me">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="truncate">My Attendance</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-9 min-w-0 justify-start gap-2 text-sm">
          <Link href="/payroll/me">
            <DollarSign className="text-muted-foreground h-4 w-4" />
            <span className="truncate">My Payslips</span>
          </Link>
        </Button>
      </div>

      {/* ── What I am supposed to be doing ─────────────────────────────────── */}
      {/* min-w-0 on the cards: a grid item defaults to min-width:auto, so a long
          task title (or any nowrap content) would otherwise widen the column past
          the viewport instead of truncating inside it. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              Today&apos;s Work
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Link href="/projects/my-tasks">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <ListSkeleton rows={3} />
            ) : !work || work.today.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="Nothing due today."
                description={
                  work && work.counts.open > 0
                    ? `${work.counts.open} task(s) open, none due today.`
                    : "No open tasks assigned to you."
                }
              />
            ) : (
              <div className="divide-y">
                {work.today.map((t) => (
                  <TaskLine key={t.id} task={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* This week, in hours - the honest version of "am I on track". */}
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading || !work ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{formatHours(work.week.spent)}</span>
                  <span className="text-muted-foreground text-xs">
                    {work.week.allocated > 0
                      ? `of ${formatHours(work.week.allocated)} booked`
                      : "spent · nothing booked"}
                  </span>
                </div>
                {/* A meter, not a chart: one ratio against a limit. */}
                <div className="bg-muted h-2 w-full overflow-hidden rounded-sm">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${pct(work.week.spent, work.week.allocated)}%`,
                      background:
                        work.week.spent > work.week.allocated
                          ? "var(--state-overdue)"
                          : "var(--state-progress)",
                    }}
                  />
                </div>
                {work.week.spent > work.week.allocated && work.week.allocated > 0 && (
                  <p className="text-xs" style={{ color: "var(--state-overdue)" }}>
                    {formatHours(work.week.spent - work.week.allocated)} over what was booked
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <WeekStat label="Done" value={work.counts.doneThisWeek} tone="done" />
                  <WeekStat label="Overdue" value={work.counts.overdue} tone="overdue" />
                  <WeekStat label="On hold" value={work.counts.onHold} tone="hold" />
                  <WeekStat label="Open" value={work.counts.open} tone="todo" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Where my work sits - one row per client still owed something. */}
      {work && work.projects.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium tracking-wider uppercase">
              My Clients
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Link href="/projects/my-projects">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {work.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-sm border px-3 py-2"
              >
                <div className="min-w-0">
                  {p.slug ? (
                    <Link
                      href={`/projects/${p.slug}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground block truncate text-sm">{p.name}</span>
                  )}
                  <p className="text-muted-foreground text-xs">{p.open} open</p>
                </div>
                {p.overdue > 0 && (
                  <span
                    className="shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ background: "var(--state-overdue)" }}
                  >
                    {p.overdue} late
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <Skeleton key={i} className="h-32 rounded-sm" />
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
              <Skeleton className="h-20 rounded-sm" />
            ) : !data?.latestPayslip ? (
              <EmptyState title="No payslips available yet." compact />
            ) : (
              <Link
                href="/payroll/me"
                className="hover:bg-muted/30 -m-2 flex items-center justify-between rounded-sm p-2 transition-colors"
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

/** Share of the booked hours already spent, capped so the meter cannot overflow. */
function pct(spent: number, allocated: number): number {
  if (allocated <= 0) return spent > 0 ? 100 : 0
  return Math.min(100, Math.round((spent / allocated) * 100))
}

const WEEK_TONES = {
  done: "var(--state-done)",
  overdue: "var(--state-overdue)",
  hold: "var(--state-hold)",
  todo: "var(--state-todo)",
} as const

/** One small count in the week panel, colour-coded to the shared state palette. */
function WeekStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: keyof typeof WEEK_TONES
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: WEEK_TONES[tone] }} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  )
}

/**
 * One task line: what it is, whose it is, and how it stands.
 *
 * Overdue and running are called out in words as well as colour - the same rule
 * the charts follow, and the reason the row is readable in a screenshot.
 */
function TaskLine({ task }: { task: DashTask }) {
  const overdue =
    !!task.dueDate &&
    new Date(task.dueDate) < new Date(new Date().toDateString()) &&
    task.status !== "ON_HOLD"
  const running = task.inProgressSince != null

  return (
    <Link
      href="/projects/my-tasks"
      className="hover:bg-muted/40 flex items-center gap-3 px-4 py-2.5 transition-colors"
    >
      <span
        className="h-6 w-1 shrink-0 rounded-sm"
        style={{
          background: overdue
            ? "var(--state-overdue)"
            : running
              ? "var(--state-progress)"
              : "var(--state-todo)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {task.project?.name ?? "ADHOC"}
          {task.estimatedHours != null && task.estimatedHours > 0 && (
            <> · {formatHours(task.estimatedHours)} booked</>
          )}
        </p>
      </div>
      {running && (
        <span className="shrink-0 text-xs font-medium" style={{ color: "var(--state-progress)" }}>
          running
        </span>
      )}
      <span
        className={cn("shrink-0 text-xs", overdue ? "font-medium" : "text-muted-foreground")}
        style={overdue ? { color: "var(--state-overdue)" } : undefined}
      >
        {overdue ? "overdue" : task.dueDate ? formatDate(task.dueDate, "dd MMM") : "no date"}
      </span>
    </Link>
  )
}
