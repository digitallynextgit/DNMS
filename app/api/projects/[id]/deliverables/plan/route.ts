import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { planDeliverables } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// POST /api/projects/[id]/deliverables/plan
//
// A whole week's commitments at once: several teams, several lines each.
// Weeks only, one week at a time - the service refuses any other window. One
// transaction, so a half-entered week never reaches the board.
//
// withProjectAccess, not withTeamStaffing: the plan spans teams, so "may they
// staff ANY team on this project" is the right question and the service is
// where it gets asked.
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const out = await planDeliverables(session, ctx.params.id!, body)
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
