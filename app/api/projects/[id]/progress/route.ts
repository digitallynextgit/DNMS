import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getProjectProgress } from "@/features/projects/server/progress.queries"
import type { Session } from "next-auth"

// GET - delivery progress for one project: task completion and punctuality
// overall, per team and per member, the weekly pace, what is due next, and how
// the tracked sites are performing in search.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    // Optional due-date window, matching the Progress page's tiles so the two
    // can never disagree about how much work is in scope.
    const { searchParams } = req.nextUrl
    const progress = await getProjectProgress(ctx.params.id!, {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    })
    if (!progress) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ data: progress })
  },
)
