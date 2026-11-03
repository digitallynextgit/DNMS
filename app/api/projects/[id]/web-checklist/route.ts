import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { getProjectWebChecklist } from "@/features/projects/server/web-checklist.service"
import type { Session } from "next-auth"

// Anyone on the project: the setup work is done by the team, not only the Account Manager.
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id: projectId } = ctx.params
    return NextResponse.json({ data: await getProjectWebChecklist(projectId!) })
  },
)
