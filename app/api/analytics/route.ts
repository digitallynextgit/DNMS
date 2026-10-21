import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { HIDDEN_ROLES, PERMISSIONS, SYSTEM_ROLES } from "@/lib/constants"
import { EMPLOYEE_SUMMARY_SELECT, VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ANALYTICS_READ,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      const hireTrendMonths = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 0)
        return { d, end }
      })

      const [
        totalEmployees,
        activeEmployees,
        newThisMonth,
        newLastMonth,
        deptHeadcount,
        pendingLeaves,
        approvedLeavesThisMonth,
        attendanceThisMonth,
        payrollThisMonth,
        openJobs,
        applicantsThisMonth,
        applicantsByStage,
        activeProjects,
        tasksCompleted,
        hireTrendCounts,
        statusDistribution,
        unassigned,
        totalDocuments,
        recentJoiners,
      ] = await Promise.all([
        db.employee.count({ where: { ...VISIBLE_EMPLOYEE_FILTER } }),
        db.employee.count({
          where: { status: "ACTIVE", isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
        }),
        db.employee.count({
          where: { createdAt: { gte: startOfMonth }, ...VISIBLE_EMPLOYEE_FILTER },
        }),
        db.employee.count({
          where: { createdAt: { gte: lastMonth, lte: endOfLastMonth }, ...VISIBLE_EMPLOYEE_FILTER },
        }),
        db.department.findMany({
          select: {
            name: true,
            _count: {
              select: {
                employees: {
                  where: { status: "ACTIVE", isActive: true, ...VISIBLE_EMPLOYEE_FILTER },
                },
              },
            },
          },
          orderBy: { employees: { _count: "desc" } },
        }),
        db.leaveRequest.count({ where: { status: "PENDING" } }),
        db.leaveRequest.count({ where: { status: "APPROVED", createdAt: { gte: startOfMonth } } }),
        db.attendanceLog.groupBy({
          by: ["status"],
          where: { date: { gte: startOfMonth } },
          _count: { id: true },
        }),
        db.payrollRecord.aggregate({
          where: {
            month: now.getMonth() === 0 ? 12 : now.getMonth(),
            year: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
          },
          _sum: { grossSalary: true, netSalary: true },
          _count: { id: true },
        }),
        db.jobPosting.count({ where: { status: "OPEN" } }),
        db.applicant.count({ where: { createdAt: { gte: startOfMonth } } }),
        db.applicant.groupBy({ by: ["stage"], _count: { id: true } }),
        db.project.count({ where: { status: "ACTIVE" } }),
        db.projectTask.count({ where: { status: "DONE", completedAt: { gte: startOfMonth } } }),
        Promise.all(
          hireTrendMonths.map(({ d, end }) =>
            db.employee.count({
              where: { createdAt: { gte: d, lte: end }, ...VISIBLE_EMPLOYEE_FILTER },
            }),
          ),
        ),
        db.employee.groupBy({
          by: ["status"],
          where: { ...VISIBLE_EMPLOYEE_FILTER },
          _count: { id: true },
        }),
        // People working here with no department set, so the headcount adds up.
        db.employee.count({
          where: {
            status: "ACTIVE",
            isActive: true,
            departmentId: null,
            ...VISIBLE_EMPLOYEE_FILTER,
          },
        }),
        db.document.count(),
        // Leadership isn't listed as joiners; a joiner needs a joining date (nulls sort first).
        db.employee.findMany({
          where: {
            isActive: true,
            dateOfJoining: { not: null },
            employeeRoles: {
              none: { role: { name: { in: [...HIDDEN_ROLES, SYSTEM_ROLES.ADMIN] } } },
            },
          },
          orderBy: { dateOfJoining: "desc" },
          take: 6,
          select: {
            ...EMPLOYEE_SUMMARY_SELECT,
            dateOfJoining: true,
            designation: { select: { title: true } },
            department: { select: { name: true } },
          },
        }),
      ])

      const hireTrend = hireTrendMonths.map(({ d }, i) => ({
        month: d.toLocaleString("default", { month: "short" }),
        count: hireTrendCounts[i] ?? 0,
      }))

      const lastPayroll =
        payrollThisMonth._count.id > 0
          ? {
              totalGross: payrollThisMonth._sum.grossSalary ?? 0,
              totalNet: payrollThisMonth._sum.netSalary ?? 0,
              count: payrollThisMonth._count.id,
              periodLabel: `${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`,
            }
          : null

      return NextResponse.json(
        {
          data: {
            employees: {
              total: totalEmployees,
              active: activeEmployees,
              newThisMonth,
              newLastMonth,
            },
            departments: deptHeadcount.map((d) => ({ name: d.name, count: d._count.employees })),
            unassigned,
            documents: { total: totalDocuments },
            recentJoiners: recentJoiners.map((e) => ({
              id: e.id,
              employeeNo: e.employeeNo,
              firstName: e.firstName,
              lastName: e.lastName,
              profilePhoto: e.profilePhoto,
              designation: e.designation?.title ?? null,
              department: e.department?.name ?? null,
              dateOfJoining: e.dateOfJoining?.toISOString().slice(0, 10) ?? null,
            })),
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
        },
        {
          // Executive numbers can be a minute stale. `private` because the result varies per viewer.
          headers: {
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
          },
        },
      )
    } catch (error) {
      console.error("[ANALYTICS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
