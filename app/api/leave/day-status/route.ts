import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { getAwayDays, getAwayDaysForMany } from "@/features/leave/server/day-status.queries"
import type { Session } from "next-auth"

// Any employee may ask about any colleague (who's off is team info), but the leave TYPE is never returned.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    const employeeId = q.get("employeeId") || session.user.id
    const employeeIds = q.get("employeeIds")
    const from = q.get("from")
    const to = q.get("to")
    if (!from || !to) return fail("BAD_REQUEST", "from and to are required (yyyy-MM-dd).", 400)

    if (employeeIds !== null) {
      const ids = employeeIds
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
      // A cap, not a page: a larger request is a bug, and silent truncation would hide it.
      if (ids.length > 100) return fail("BAD_REQUEST", "Too many employees (max 100).", 400)
      return ok(await getAwayDaysForMany(ids, from, to))
    }

    return ok(await getAwayDays(employeeId, from, to))
  },
)
