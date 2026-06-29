import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { EMPLOYEE_SUMMARY_SELECT, VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"

export const GET = withAuth(
  PERMISSIONS.DASHBOARD_READ,
  async (_req: NextRequest, _context: { params: Record<string, string> }) => {
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

    return NextResponse.json({
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
    })
  },
)
