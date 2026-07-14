import { NextRequest, NextResponse } from "next/server"
import { withSession } from "@/server/api-handler"
import { getMyDashboard } from "@/features/dashboard/server/dashboard.queries"
import type { Session } from "next-auth"

// Personal self-service dashboard for regular employees. Unlike
// /api/dashboard/stats (org-wide HR data, gated by dashboard:read), this only
// ever returns data scoped to the signed-in employee. The query lives in
// features/dashboard/server/dashboard.queries.ts so the dashboard page can
// prefetch it server-side without an HTTP hop.
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      return NextResponse.json(await getMyDashboard(session.user.id))
    } catch (error) {
      console.error("[DASHBOARD_ME_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
