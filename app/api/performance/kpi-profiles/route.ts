import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"

// List active employees with their KPI-profile status (how many manager-side and
// self-side items each has configured), for the KPI Profiles overview.
export const GET = withAuth(PERMISSIONS.PERFORMANCE_REVIEW, async () => {
  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      profilePhoto: true,
      designation: { select: { title: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

  const counts = await db.perfKpi.groupBy({
    by: ["employeeId", "evaluator"],
    where: { employeeId: { in: employees.map((e) => e.id) } },
    _count: { _all: true },
  })
  const managerBy = new Map<string, number>()
  const selfBy = new Map<string, number>()
  for (const c of counts) {
    if (c.evaluator === "MANAGER") managerBy.set(c.employeeId, c._count._all)
    else if (c.evaluator === "SELF") selfBy.set(c.employeeId, c._count._all)
  }

  const data = employees.map((e) => {
    const managerCount = managerBy.get(e.id) ?? 0
    const selfCount = selfBy.get(e.id) ?? 0
    return {
      id: e.id,
      employeeNo: e.employeeNo,
      firstName: e.firstName,
      lastName: e.lastName,
      profilePhoto: e.profilePhoto,
      designation: e.designation?.title ?? null,
      department: e.department?.name ?? null,
      managerCount,
      selfCount,
      configured: managerCount + selfCount > 0,
    }
  })

  return NextResponse.json({ data })
})
