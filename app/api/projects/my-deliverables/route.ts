import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getMyOwedDeliverables } from "@/features/projects/server/deliverables.queries"

// Rows assigned to the caller plus unclaimed rows their team owes. Session-scoped by definition.
export const dynamic = "force-dynamic"

export const GET = withSession(async (req: NextRequest, _ctx, session: Session) => {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"))
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : undefined
  return NextResponse.json({ data: await getMyOwedDeliverables(session, { limit }) })
})
