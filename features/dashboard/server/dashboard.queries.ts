import "server-only"

import { db } from "@/server/db"
import { EMPLOYEE_SUMMARY_SELECT, VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"

// Dashboard data reads.
//
// Extracted from GET /api/dashboard/stats and GET /api/dashboard/me so the route
// handlers AND the server-side prefetch in app/(dashboard)/dashboard/page.tsx run
// the exact same query - the prefetched React Query cache entry must be
// byte-identical to the API body the client would otherwise have fetched.
// Each function returns its route's payload shape verbatim.

/** Org-wide HR stats (route is gated by dashboard:read). */
export async function getDashboardStats() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [
    totalEmployees,
    newThisMonth,
    byStatus,
    byDepartment,
    totalDocuments,
    unreadNotifications,
    recentJoiners,
  ] = await Promise.all([
    // Total active employees
    db.employee.count({
      where: { status: "ACTIVE", isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
    }),

    // Joined in the last 30 days
    db.employee.count({
      where: {
        isActive: true,
        dateOfJoining: { gte: thirtyDaysAgo },
        ...VISIBLE_EMPLOYEE_FILTER,
      },
    }),

    // Grouped by status
    db.employee.groupBy({
      by: ["status"],
      where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
      _count: { _all: true },
    }),

    // Grouped by department
    db.employee.groupBy({
      by: ["departmentId"],
      where: { status: "ACTIVE", isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
      _count: { _all: true },
    }),

    // Total documents
    db.document.count(),

    // Unread notifications
    db.notification.count({
      where: { isRead: false },
    }),

    // Last 5 joiners
    db.employee.findMany({
      where: { isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
      orderBy: { dateOfJoining: "desc" },
      take: 5,
      select: {
        ...EMPLOYEE_SUMMARY_SELECT,
        dateOfJoining: true,
        designation: {
          select: { title: true },
        },
        department: {
          select: { name: true },
        },
      },
    }),
  ])

  // Resolve department ids → names for the byDepartment groupBy result
  const departmentIds = byDepartment.map((d) => d.departmentId).filter(Boolean) as string[]

  const departments = await db.department.findMany({
    where: { id: { in: departmentIds } },
    select: { id: true, name: true },
  })

  const departmentIdToName = new Map(departments.map((d) => [d.id, d.name]))

  const byDepartmentNamed = byDepartment
    .map((d) => ({
      department: d.departmentId
        ? (departmentIdToName.get(d.departmentId) ?? "Unknown")
        : "Unassigned",
      count: d._count._all,
    }))
    .sort((a, b) => b.count - a.count)

  const byStatusMapped = byStatus.map((s) => ({
    status: s.status,
    count: s._count._all,
  }))

  return {
    employees: {
      total: totalEmployees,
      newThisMonth,
      byStatus: byStatusMapped,
      byDepartment: byDepartmentNamed,
    },
    documents: {
      total: totalDocuments,
    },
    notifications: {
      unread: unreadNotifications,
    },
    recentJoiners,
  }
}

/**
 * Personal self-service dashboard for regular employees. Unlike
 * getDashboardStats (org-wide HR data, gated by dashboard:read), this only ever
 * returns data scoped to the given employee.
 */
export async function getMyDashboard(employeeId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const year = now.getFullYear()
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // The working week the allocation sheet is written in (Mon 00:00 -> Sun 23:59,
  // local), so "this week" here means the same days it does in My Tasks.
  const weekStart = new Date(todayDateOnly)
  weekStart.setDate(weekStart.getDate() - ((now.getDay() + 6) % 7))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const [
    employee,
    attendanceThisMonth,
    leaveBalances,
    latestPayslip,
    pendingLeave,
    pendingWfh,
    upcomingHolidays,
    unreadNotifications,
    openTasks,
    doneThisWeek,
  ] = await Promise.all([
    db.employee.findUnique({
      where: { id: employeeId },
      select: {
        firstName: true,
        lastName: true,
        dateOfJoining: true,
        designation: { select: { title: true } },
        department: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    }),

    // This month's attendance logs (for the per-status summary)
    db.attendanceLog.findMany({
      where: { employeeId, date: { gte: monthStart, lte: monthEnd } },
      select: { status: true, workHours: true },
    }),

    // Current-year leave balances
    db.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    }),

    // Most recent payslip that has actually been processed/paid
    db.payrollRecord.findFirst({
      where: { employeeId, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        id: true,
        month: true,
        year: true,
        netSalary: true,
        status: true,
        paidAt: true,
      },
    }),

    db.leaveRequest.count({ where: { employeeId, status: "PENDING" } }),
    db.wfhRequest.count({ where: { employeeId, status: "PENDING" } }),

    // Next holidays from today
    db.holiday.findMany({
      where: { date: { gte: todayDateOnly } },
      orderBy: { date: "asc" },
      take: 5,
      select: { id: true, name: true, date: true, isOptional: true },
    }),

    db.notification.count({ where: { employeeId, isRead: false } }),

    // Everything still on this person's plate. Scoped to OPEN work rather than
    // every task they have ever had, so the query stays flat as history grows.
    db.projectTask.findMany({
      where: {
        assigneeId: employeeId,
        status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        estimatedHours: true,
        loggedHours: true,
        inProgressSince: true,
        holdExpectedDate: true,
        project: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ dueDate: "asc" }],
    }),

    // Finished this week - the "look what I got done" half of the picture,
    // which open tasks alone can never show.
    db.projectTask.findMany({
      where: {
        assigneeId: employeeId,
        status: "DONE",
        completedAt: { gte: weekStart, lte: weekEnd },
      },
      select: { id: true, loggedHours: true, estimatedHours: true },
    }),
  ])

  // Roll up attendance counts by status
  const attendance = {
    present: 0,
    absent: 0,
    halfDay: 0,
    onLeave: 0,
    totalHours: 0,
    workingDays: 0,
  }
  for (const log of attendanceThisMonth) {
    if (log.status === "PRESENT" || log.status === "LATE") attendance.present++
    else if (log.status === "ABSENT") attendance.absent++
    else if (log.status === "HALF_DAY") attendance.halfDay++
    else if (log.status === "ON_LEAVE") attendance.onLeave++

    if (log.workHours && log.workHours > 0) {
      attendance.totalHours += log.workHours
      attendance.workingDays++
    }
  }
  const avgHours =
    attendance.workingDays > 0
      ? Math.round((attendance.totalHours / attendance.workingDays) * 10) / 10
      : 0

  // Aggregate available leave across all types
  const totalLeaveAvailable = leaveBalances.reduce((sum, b) => {
    const available = Math.max(0, b.allocated + b.carried - b.used - b.pending)
    return sum + available
  }, 0)

  // ── Work ──────────────────────────────────────────────────────────────────
  // An employee opens this page to answer "what am I supposed to be doing right
  // now", and until now it could not tell them: the whole panel was HR data.
  const sameDay = (d: Date | null) =>
    !!d &&
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === todayDateOnly.getTime()

  // Overdue = past its due day AND still actionable. On hold is deliberately
  // excluded: it was parked on purpose, which is a decision, not a slip.
  const isOverdue = (t: (typeof openTasks)[number]) =>
    !!t.dueDate &&
    new Date(t.dueDate.getFullYear(), t.dueDate.getMonth(), t.dueDate.getDate()) < todayDateOnly &&
    t.status !== "ON_HOLD"

  // ON_HOLD is excluded for the same reason it is never counted overdue: it was
  // parked on purpose, and its unfinished hours already live on a follow-up task
  // dated for the day it resumes. Listing it as "due today" would put work in
  // front of someone that they have explicitly decided not to do today.
  const dueToday = openTasks.filter(
    (t) => sameDay(t.dueDate) && !isOverdue(t) && t.status !== "ON_HOLD",
  )
  const overdue = openTasks.filter(isOverdue)
  const running = openTasks.filter((t) => t.inProgressSince != null)
  const onHold = openTasks.filter((t) => t.status === "ON_HOLD")

  const inWeek = (d: Date | null) => !!d && d >= weekStart && d <= weekEnd
  const weekTasks = openTasks.filter((t) => inWeek(t.dueDate))
  const weekAllocated =
    weekTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0) +
    doneThisWeek.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const weekSpent =
    weekTasks.reduce((s, t) => s + t.loggedHours, 0) +
    doneThisWeek.reduce((s, t) => s + t.loggedHours, 0)

  // One row per client the person still owes work to, busiest first.
  const projectMap = new Map<
    string,
    { id: string; name: string; slug: string | null; open: number; overdue: number }
  >()
  for (const t of openTasks) {
    const key = t.project?.id ?? "__adhoc__"
    const entry = projectMap.get(key) ?? {
      id: key,
      name: t.project?.name ?? "ADHOC",
      slug: t.project?.slug ?? null,
      open: 0,
      overdue: 0,
    }
    entry.open++
    if (isOverdue(t)) entry.overdue++
    projectMap.set(key, entry)
  }

  /** Just enough of a task to render a row and link to it. */
  const slim = (t: (typeof openTasks)[number]) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    estimatedHours: t.estimatedHours,
    loggedHours: t.loggedHours,
    inProgressSince: t.inProgressSince?.toISOString() ?? null,
    project: t.project,
  })

  return {
    employee,
    attendance: {
      present: attendance.present,
      absent: attendance.absent,
      halfDay: attendance.halfDay,
      onLeave: attendance.onLeave,
      avgHours,
      month: monthStart.toISOString(),
    },
    leaveBalances,
    totalLeaveAvailable,
    latestPayslip,
    pending: { leave: pendingLeave, wfh: pendingWfh },
    upcomingHolidays,
    notifications: { unread: unreadNotifications },
    work: {
      counts: {
        open: openTasks.length,
        dueToday: dueToday.length,
        overdue: overdue.length,
        running: running.length,
        onHold: onHold.length,
        doneThisWeek: doneThisWeek.length,
      },
      week: {
        allocated: Math.round(weekAllocated * 100) / 100,
        spent: Math.round(weekSpent * 100) / 100,
      },
      // Overdue first - it is the work that needs a decision today - then what
      // is actually due today. Capped: this is a glance, not the task list.
      today: [...overdue, ...dueToday].slice(0, 6).map(slim),
      running: running.map(slim),
      projects: [...projectMap.values()].sort((a, b) => b.open - a.open),
    },
  }
}
