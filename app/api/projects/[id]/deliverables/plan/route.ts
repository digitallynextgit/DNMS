import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { planDeliverables } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// One week at a time, in one transaction. withProjectAccess: the plan spans teams, so the service
// checks whether they may staff any team on the project.
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
