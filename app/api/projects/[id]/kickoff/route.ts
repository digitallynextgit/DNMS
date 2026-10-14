import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getProjectKickoff } from "@/features/projects/server/kickoff.service"
import type { Session } from "next-auth"

// Manager-only: the kickoff must-haves are the Account Manager's own checklist.
export const GET = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId } = ctx.params
    return NextResponse.json({ data: await getProjectKickoff(projectId!) })
  },
)
