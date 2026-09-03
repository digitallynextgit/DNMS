import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getGoalsPortfolio } from "@/features/projects/server/goals-portfolio.queries"

// GET /api/projects/goals
//
// Goals across every project the caller can see, for the Progress page. Optional
// ?projectId narrows to one, matching the picker at the top of that page.
//
// Static segment beside the dynamic [id] one, exactly like
// /api/projects/performance: Next resolves the literal path first, so this does
// not shadow /api/projects/<id>.
//
// withSession rather than a permission gate: the query itself is scoped to the
// projects this person may read (see scopeWhere), so a team member gets their
// own projects and an admin gets the portfolio, from the same endpoint.
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined
    return NextResponse.json({ data: await getGoalsPortfolio(session, { projectId }) })
  },
)
