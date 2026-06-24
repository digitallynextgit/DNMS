import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ANALYTICS_READ,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // Employee stats
      const [totalEmployees, activeEmployees, newThisMonth, newLastMonth] = await Promise.all([
        db.employee.count(),
        db.employee.count({ where: { status: "ACTIVE" } }),
        db.employee.count({ where: { createdAt: { gte: startOfMonth } } }),
        db.employee.count({ where: { createdAt: { gte: lastMonth, lte: endOfLastMonth } } }),
      ])

      // Department headcount
      const deptHeadcount = await db.department.findMany({
        select: {
          name: true,
          _count: { select: { employees: { where: { status: "ACTIVE" } } } },
        },
        orderBy: { employees: { _count: "desc" } },
      })

      // Leave stats
      const [pendingLeaves, approvedLeavesThisMonth] = await Promise.all([
        db.leaveRequest.count({ where: { status: "PENDING" } }),
        db.leaveRequest.count({ where: { status: "APPROVED", createdAt: { gte: startOfMonth } } }),
      ])

      // Attendance stats (this month)
      const attendanceThisMonth = await db.attendanceLog.groupBy({
        by: ["status"],
        where: { date: { gte: startOfMonth } },
        _count: { id: true },
      })

      // Payroll stats (aggregate from last month)
      const payrollThisMonth = await db.payrollRecord.aggregate({
        where: {
          month: now.getMonth() === 0 ? 12 : now.getMonth(),
          year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
        },
        _sum: { grossSalary: true, netSalary: true },
        _count: { id: true },
      })
      const lastPayroll =
        payrollThisMonth._count.id > 0
          ? {
              totalGross: payrollThisMonth._sum.grossSalary ?? 0,
              totalNet: payrollThisMonth._sum.netSalary ?? 0,
              count: payrollThisMonth._count.id,
              periodLabel: `${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`,
            }
          : null

      // Recruitment stats
      const [openJobs, applicantsThisMonth] = await Promise.all([
        db.jobPosting.count({ where: { status: "OPEN" } }),
        db.applicant.count({ where: { createdAt: { gte: startOfMonth } } }),
      ])

      // Applicants by stage
      const applicantsByStage = await db.applicant.groupBy({
        by: ["stage"],
        _count: { id: true },
      })

      // Projects stats
      const [activeProjects, tasksCompleted] = await Promise.all([
        db.project.count({ where: { status: "ACTIVE" } }),
        db.projectTask.count({ where: { status: "DONE", completedAt: { gte: startOfMonth } } }),
      ])

      // Monthly hire trend (last 6 months)
      const hireTrend = await Promise.all(
        Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
          const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0)
          return db.employee
            .count({ where: { createdAt: { gte: d, lte: end } } })
            .then((count) => ({
              month: d.toLocaleString("default", { month: "short" }),
              count,
            }))
        }),
      )

      // Employee status distribution
      const statusDistribution = await db.employee.groupBy({
        by: ["status"],
        _count: { id: true },
      })

      return NextResponse.json({
        data: {
          employees: { total: totalEmployees, active: activeEmployees, newThisMonth, newLastMonth },
          departments: deptHeadcount.map((d) => ({ name: d.name, count: d._count.employees })),
          leave: { pending: pendingLeaves, approvedThisMonth: approvedLeavesThisMonth },
          attendance: attendanceThisMonth.reduce(
            (acc, g) => ({ ...acc, [g.status]: g._count.id }),
            {} as Record<string, number>,
          ),
          payroll: lastPayroll,
          recruitment: {
            openJobs,
            applicantsThisMonth,
            byStage: applicantsByStage.map((a) => ({ stage: a.stage, count: a._count.id })),
          },
          projects: { active: activeProjects, tasksCompletedThisMonth: tasksCompleted },
          trends: { hires: hireTrend },
          statusDistribution: statusDistribution.map((s) => ({
            status: s.status,
            count: s._count.id,
          })),
        },
      })
    } catch (error) {
      console.error("[ANALYTICS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
