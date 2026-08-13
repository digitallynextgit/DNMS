import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { getAwayDays } from "@/features/leave/server/day-status.queries"
import type { Session } from "next-auth"

// GET /api/leave/day-status?employeeId=&from=&to=
//
// Which days someone is away, for the weekly task sheet.
//
// Any signed-in employee may ask about any colleague, and that is deliberate:
// "who is off on Thursday" is ordinary team information, already visible on the
// holiday calendar and in the team views. What is NOT returned is the leave
// TYPE - the reason someone is off is theirs, and a task board has no need of it.
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    // Defaults to the caller, so the common case needs no id at all.
    const employeeId = q.get("employeeId") || session.user.id
    const from = q.get("from")
    const to = q.get("to")
    if (!from || !to) return fail("BAD_REQUEST", "from and to are required (yyyy-MM-dd).", 400)

    return ok(await getAwayDays(employeeId, from, to))
  },
)
