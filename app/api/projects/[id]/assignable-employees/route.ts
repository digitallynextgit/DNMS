import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withTeamStaffing } from "@/features/projects/server/project-access"
import { HIDDEN_ROLES } from "@/lib/constants"
import type { Session } from "next-auth"

// /api/employees needs the global employee:read; this gives project staffers just enough to pick a colleague.
export const GET = withTeamStaffing(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const employees = await db.employee.findMany({
        where: {
          isActive: true,
          status: "ACTIVE",
          // Never surface the silent admin_ watch account.
          NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          profilePhoto: true,
          designation: { select: { title: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      })
      return NextResponse.json({ data: employees })
    } catch (error) {
      console.error("[PROJECT_ASSIGNABLE_EMPLOYEES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
