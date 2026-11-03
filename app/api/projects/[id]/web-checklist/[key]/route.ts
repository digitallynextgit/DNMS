import { NextRequest, NextResponse } from "next/server"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { setWebChecklistItem } from "@/features/projects/server/web-checklist.service"
import { webChecklistItemPatchSchema } from "@/features/projects/schemas/web-checklist.schema"
import { actorStampId } from "@/lib/audit"
import type { Session } from "next-auth"

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const { id: projectId, key } = ctx.params
    const patch = webChecklistItemPatchSchema.parse(await req.json())
    return NextResponse.json({
      data: await setWebChecklistItem(projectId!, key!, patch, actorStampId(session)),
    })
  },
)
