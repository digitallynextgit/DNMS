import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { listDeliverableEvents } from "@/features/projects/server/deliverables.queries"

// GET /api/projects/[id]/deliverables/[deliverableId]/events
//
// The row's history, oldest first. Readable by anyone who can see the project:
// how a reported number came to be what it is is not a manager-only question.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    return NextResponse.json({
      data: await listDeliverableEvents(session, ctx.params.id!, ctx.params.deliverableId!),
    })
  },
)
