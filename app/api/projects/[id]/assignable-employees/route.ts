import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withTeamStaffing } from "@/features/projects/server/project-access"
import { HIDDEN_ROLES } from "@/lib/constants"
import type { Session } from "next-auth"

// GET /api/projects/[id]/assignable-employees
//
// The roster the "Add member" picker chooses from, scoped to ONE project.
//
// Why this exists instead of reusing /api/employees: that endpoint requires the
// global `employee:read` (admin / HR only), but an Account Manager is usually a
// plain `employee` who just happens to own a project - so the picker came back
// empty for them and they couldn't staff their own team. Granting them
// `employee:read` would have handed every project owner the full HR directory,
// so this returns the bare minimum needed to identify a colleague, and only to
// someone who can already staff a team in THIS project.
//
// Team managers are included: the add/remove member routes have always accepted
// them, but this roster did not, so their picker came back 403 and empty.
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
