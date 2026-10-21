import { NextRequest, NextResponse } from "next/server"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getCalendarOverview } from "@/features/projects/server/calendar-overview.queries"

// The project's calendars for a month (Analytics > Calendars): owners, teams and people on each,
// their progress, and rows per tab. Anyone on the project.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }) =>
    NextResponse.json({
      data: await getCalendarOverview(ctx.params.id!, req.nextUrl.searchParams.get("month")),
    }),
)
