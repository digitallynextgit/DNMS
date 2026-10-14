import { NextRequest, NextResponse } from "next/server"
import { withProjectManager } from "@/features/projects/server/project-access"
import { setKickoffItem } from "@/features/projects/server/kickoff.service"
import { kickoffItemPatchSchema } from "@/features/projects/schemas/kickoff.schema"
import type { Session } from "next-auth"

export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, key } = ctx.params
    const patch = kickoffItemPatchSchema.parse(await req.json())
    return NextResponse.json({
      data: await setKickoffItem(projectId!, key!, patch, session.user.id),
    })
  },
)
