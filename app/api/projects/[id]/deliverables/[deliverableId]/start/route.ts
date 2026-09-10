import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { startDeliverable } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// POST /api/projects/[id]/deliverables/[deliverableId]/start
//
// "I am doing this one." Claims the row if nobody had it, moves it to
// IN_PROGRESS, and creates the task that tracks the doing - all as one write,
// because they are one decision.
//
// withProjectAccess, not withTeamStaffing: a member starting work their team
// was already committed to is not raising new scope. The service still refuses
// anyone with no standing on the row.
export const POST = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const out = await startDeliverable(session, ctx.params.id!, ctx.params.deliverableId!)
      return NextResponse.json({ data: out }, { status: 201 })
    } catch (err) {
      if (err instanceof AppError) {
        const code = (err.details as { code?: string } | undefined)?.code ?? err.code
        return NextResponse.json({ error: err.message, code }, { status: err.statusCode })
      }
      throw err
    }
  },
)
