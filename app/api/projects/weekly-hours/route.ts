import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { getWeeklyHours, visiblePeople } from "@/features/projects/server/weekly-hours.queries"
import { mondayOf } from "@/features/projects/lib/work-week"
import type { Session } from "next-auth"

// `week` is any day in the week; it's normalised to Monday. See visiblePeople for who's included.
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
