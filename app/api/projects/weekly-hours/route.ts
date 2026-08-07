import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { getWeeklyHours, visiblePeople } from "@/features/projects/server/weekly-hours.queries"
import { mondayOf } from "@/features/projects/lib/work-week"
import type { Session } from "next-auth"

// GET /api/projects/weekly-hours?week=yyyy-mm-dd
//
// One week of logged hours for whoever the caller may see - see visiblePeople
// for the rule. `week` is any day inside the week; it is normalised to that
// week's Monday, so the caller never has to know which day rows are keyed by.
export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const raw = req.nextUrl.searchParams.get("week")
    const parsed = raw ? new Date(`${raw}T00:00:00`) : new Date()
    const monday = mondayOf(Number.isNaN(parsed.getTime()) ? new Date() : parsed)

    const { memberIds, scope } = await visiblePeople(session)
    return NextResponse.json({ data: await getWeeklyHours(memberIds, monday, scope) })
  } catch (error) {
    console.error("[WEEKLY_HOURS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
