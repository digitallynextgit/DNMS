import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { startDeliverable } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// Claims the row, moves it to IN_PROGRESS and creates its task in one write. withProjectAccess, not
// withTeamStaffing: starting committed work isn't new scope (the service still checks standing).
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
