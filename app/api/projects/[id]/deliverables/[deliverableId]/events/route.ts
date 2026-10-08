import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { listDeliverableEvents } from "@/features/projects/server/deliverables.queries"

// Readable by anyone who can see the project, not just managers.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    return NextResponse.json({
      data: await listDeliverableEvents(session, ctx.params.id!, ctx.params.deliverableId!),
    })
  },
)
