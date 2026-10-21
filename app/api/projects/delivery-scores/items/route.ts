import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getDeliveryScoreItems } from "@/features/projects/server/delivery-score.queries"

// One person's or one team's month on Team Performance, item by item: the goals, deliverables and
// tasks behind their score and how each counted. Same scope as the list.
export const dynamic = "force-dynamic"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  const q = req.nextUrl.searchParams
  const data = await getDeliveryScoreItems(session, {
    month: q.get("month"),
    projectId: q.get("projectId"),
    personId: q.get("personId"),
    teamId: q.get("teamId"),
  })
  return NextResponse.json({ data })
})
