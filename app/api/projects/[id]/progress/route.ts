import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getProjectProgress } from "@/features/projects/server/progress.queries"
import type { Session } from "next-auth"

// GET - delivery progress for one project: task completion and punctuality
// overall, per team and per member, the weekly pace, what is due next, and how
// the tracked sites are performing in search.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const progress = await getProjectProgress(ctx.params.id!)
    if (!progress) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ data: progress })
  },
)
