import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { teamAssignContext } from "@/features/projects/server/task-assign.service"
import { assignableIds } from "@/features/projects/lib/task-assign"

// Whom the caller may give a task on this team to: themselves and their reports on it, or anyone on
// it for the team's and the project's managers. The assignee pickers read this.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const assign = await teamAssignContext(session, ctx.params.id!, ctx.params.teamId!)
    if (!assign) return NextResponse.json({ error: "Team not found" }, { status: 404 })
    return NextResponse.json({
      data: { ids: assignableIds(assign), canAssignAnyone: assign.canAssignAnyone },
    })
  },
)
