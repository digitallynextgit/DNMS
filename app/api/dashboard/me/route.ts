import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// Personal self-service dashboard for regular employees. Unlike
// /api/dashboard/stats (org-wide HR data, gated by dashboard:read), this only
// ever returns data scoped to the signed-in employee.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const employeeId = session.user.id

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const year = now.getFullYear()
      const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const [
        employee,
        attendanceThisMonth,
        leaveBalances,
        latestPayslip,
        pendingLeave,
        pendingWfh,
        upcomingHolidays,
        unreadNotifications,
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

      return NextResponse.json({
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
      })
    } catch (error) {
      console.error("[DASHBOARD_ME_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
