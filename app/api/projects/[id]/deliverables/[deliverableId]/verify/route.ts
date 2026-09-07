import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getDeliverableRow } from "@/features/projects/server/deliverables.queries"
import { verifyDeliverable } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// POST /api/projects/[id]/deliverables/[deliverableId]/verify { verified: boolean }
//
// Internal QC sign-off, not the client's verdict: a manager saying they have
// looked at it. A toggle rather than a one-way flag, because a sign-off given
// by mistake has to be retractable - both directions are written to history.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const projectId = ctx.params.id!
      const id = ctx.params.deliverableId!
      await verifyDeliverable(session, projectId, id, body?.verified !== false)
      return NextResponse.json({ data: await getDeliverableRow(session, projectId, id) })
    } catch (err) {
      if (err instanceof AppError) {
        const code = (err.details as { code?: string } | undefined)?.code ?? err.code
        return NextResponse.json({ error: err.message, code }, { status: err.statusCode })
      }
      throw err
    }
  },
)
