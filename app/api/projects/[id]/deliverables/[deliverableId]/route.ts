import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getDeliverableRow } from "@/features/projects/server/deliverables.queries"
import {
  deleteDeliverable,
  updateDeliverable,
} from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// The service checks the entry belongs to the project, that this person may touch it, and that
// the period is still open.
export const dynamic = "force-dynamic"

/** A refusal the form can act on: the prose to show, plus why it was refused. */
function failure(err: AppError) {
  const code = (err.details as { code?: string } | undefined)?.code ?? err.code
  return NextResponse.json({ error: err.message, code }, { status: err.statusCode })
}

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const projectId = ctx.params.id!
      const id = ctx.params.deliverableId!
      await updateDeliverable(session, projectId, id, body)
      // Return the saved row so the list can patch in place instead of refetching.
      return NextResponse.json({ data: await getDeliverableRow(session, projectId, id) })
    } catch (err) {
      if (err instanceof AppError) return failure(err)
      throw err
    }
  },
)

export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      await deleteDeliverable(session, ctx.params.id!, ctx.params.deliverableId!)
      return NextResponse.json({ data: { ok: true } })
    } catch (err) {
      if (err instanceof AppError) return failure(err)
      throw err
    }
  },
)
