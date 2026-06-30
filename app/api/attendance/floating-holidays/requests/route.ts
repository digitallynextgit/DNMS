import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { SYSTEM_ROLES } from "@/lib/constants"
import { resolvePagination, paginationMeta } from "@/lib/pagination"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

// HR roles see every request; a manager sees only their direct reports' requests.
const HR_ROLES: string[] = [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.ADMIN_]

// GET /api/attendance/floating-holidays/requests?status=PENDING
// Floating-holiday requests for an approver (manager of the employee, or HR).
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const sp = new URL(req.url).searchParams
      const status = sp.get("status") ?? undefined
      const { page, limit, skip, take } = resolvePagination(
        { page: sp.get("page"), limit: sp.get("limit") },
        10,
      )

      const isHr = (session.user.roles ?? []).some((r) => HR_ROLES.includes(r))

      const where: Record<string, unknown> = {}
      if (status) where.status = status
      // Managers (non-HR) only see requests from people who report to them.
      if (!isHr) where.employee = { managerId: session.user.id }

      const [requests, total] = await Promise.all([
        db.floatingHolidaySelection.findMany({
          where,
          include: {
            employee: { select: EMPLOYEE_SUMMARY_SELECT },
            holiday: { select: { id: true, name: true, date: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        db.floatingHolidaySelection.count({ where }),
      ])

      return NextResponse.json({ data: requests, pagination: paginationMeta(total, page, limit) })
    } catch (error) {
      console.error("[FLOATING_HOLIDAY_REQUESTS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
