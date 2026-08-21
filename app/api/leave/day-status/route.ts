import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { getAwayDays, getAwayDaysForMany } from "@/features/leave/server/day-status.queries"
import type { Session } from "next-auth"

// GET /api/leave/day-status?employeeId=&from=&to=     -> AwayDay[]
// GET /api/leave/day-status?employeeIds=a,b,c&from=&to= -> { [id]: AwayDay[] }
//
// Which days someone is away, for the weekly task sheet. The plural form is for
// the project sheet, which plans a row per person and would otherwise open one
// request per row every time the week is stepped.
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
    const employeeIds = q.get("employeeIds")
    const from = q.get("from")
    const to = q.get("to")
    if (!from || !to) return fail("BAD_REQUEST", "from and to are required (yyyy-MM-dd).", 400)

    if (employeeIds !== null) {
      const ids = employeeIds
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
      // A cap, not a page: this answers a sheet that is already rows-on-a-screen
      // wide. Anything larger is a mistake, and silently truncating it would
      // leave rows unexplained rather than saying so.
      if (ids.length > 100) return fail("BAD_REQUEST", "Too many employees (max 100).", 400)
      return ok(await getAwayDaysForMany(ids, from, to))
    }

    return ok(await getAwayDays(employeeId, from, to))
  },
)
