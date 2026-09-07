import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getDeliverableRow } from "@/features/projects/server/deliverables.queries"
import {
  deleteDeliverable,
  updateDeliverable,
} from "@/features/projects/server/deliverables.service"
import { AppError } from "@/lib/errors"

// PATCH  /api/projects/[id]/deliverables/[deliverableId] - edit an entry, and
//        optionally move it (body may carry `status`, plus `reason` / `note`)
// DELETE /api/projects/[id]/deliverables/[deliverableId] - remove it (files stay)
//
// withProjectAccess resolves and authorises the PROJECT; the service then
// checks the entry belongs to it and that this person may touch it (their own,
// or their team's, or they run the project), and that the period is still open.
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
      // Hand the saved row back so the list can patch in place - a status change
      // moves the row between tiles and a refetch of the whole ledger to learn
      // that is a lot of round-trips for one click.
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
