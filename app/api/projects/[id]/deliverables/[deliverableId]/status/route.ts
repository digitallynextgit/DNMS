import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getDeliverableRow } from "@/features/projects/server/deliverables.queries"
import { setDeliverableStatus } from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// One-click row actions. The service enforces the lifecycle table and returns the saved row.
export const dynamic = "force-dynamic"

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const projectId = ctx.params.id!
      const id = ctx.params.deliverableId!
      await setDeliverableStatus(session, projectId, id, body)
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
