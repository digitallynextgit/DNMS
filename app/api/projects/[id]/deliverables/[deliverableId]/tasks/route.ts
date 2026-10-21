import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  getDeliverableTasks,
  splitDeliverable,
  type SplitLine,
} from "@/features/projects/server/deliverable-tasks.service"
import { AppError } from "@/lib/errors"

// The tasks a planned deliverable is split into (anyone on the project), and splitting it (the
// owing team and its managers; the service checks who may be given each task).
export const dynamic = "force-dynamic"

function failure(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode })
  }
  throw err
}

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      return NextResponse.json({
        data: await getDeliverableTasks(session, ctx.params.id!, ctx.params.deliverableId!),
      })
    } catch (err) {
      return failure(err)
    }
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const body = (await req.json().catch(() => ({}))) as { tasks?: SplitLine[] }
    try {
      const out = await splitDeliverable(
        session,
        ctx.params.id!,
        ctx.params.deliverableId!,
        body.tasks ?? [],
      )
      return NextResponse.json({ data: out }, { status: 201 })
    } catch (err) {
      return failure(err)
    }
  },
)
