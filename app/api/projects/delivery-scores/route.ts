import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getDeliveryScores } from "@/features/projects/server/delivery-score.queries"

// Delivery scores for a month: people and teams, each one score with its parts. Scoped like the
// Progress page - admins everyone, account managers their projects, team managers their teams and
// reports, members themselves.
export const dynamic = "force-dynamic"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  const q = req.nextUrl.searchParams
  const data = await getDeliveryScores(session, {
    month: q.get("month"),
    projectId: q.get("projectId"),
  })
  return NextResponse.json({ data })
})
