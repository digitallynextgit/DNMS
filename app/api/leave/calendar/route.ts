import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession, hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// GET /api/leave/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
// Approved leaves overlapping the range. Approvers see everyone; others only own.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const sp = new URL(req.url).searchParams
      const now = new Date()
      const from = sp.get("from")
        ? new Date(sp.get("from")!)
        : new Date(now.getFullYear(), now.getMonth(), 1)
      const to = sp.get("to")
        ? new Date(sp.get("to")!)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const where: Record<string, unknown> = {
        status: "APPROVED",
        startDate: { lte: to },
        endDate: { gte: from },
      }
      if (!hasPermission(session, PERMISSIONS.LEAVE_APPROVE)) {
        where.employeeId = session.user.id
      }

      const leaves = await db.leaveRequest.findMany({
        where,
        orderBy: { startDate: "asc" },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNo: true,
              profilePhoto: true,
            },
          },
          leaveType: { select: { name: true, code: true } },
        },
      })

      return NextResponse.json({ data: leaves })
    } catch (error) {
      console.error("[LEAVE_CALENDAR_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
