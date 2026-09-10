import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getMyOwedDeliverables } from "@/features/projects/server/deliverables.queries"

// GET /api/projects/my-deliverables
//
// What the signed-in person owes, across every project: rows assigned to them,
// plus rows their team owes that nobody has claimed. Session-scoped by
// definition - there is no id to pass, and no way to ask about someone else.
export const dynamic = "force-dynamic"

export const GET = withSession(async (req: NextRequest, _ctx, session: Session) => {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : undefined
  return NextResponse.json({ data: await getMyOwedDeliverables(session, { limit }) })
})
