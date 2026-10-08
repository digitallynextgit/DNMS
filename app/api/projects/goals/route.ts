import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getGoalsPortfolio } from "@/features/projects/server/goals-portfolio.queries"

// withSession, not a permission gate: the query is scoped to the projects this person may read.
export const dynamic = "force-dynamic"

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined
    return NextResponse.json({ data: await getGoalsPortfolio(session, { projectId }) })
  },
)
