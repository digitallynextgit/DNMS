import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { addTaskWorkLog, getTaskWork } from "@/features/projects/server/task-work-logs.service"
import { AppError } from "@/lib/errors"

// A task's work log: what was done each day, and how many were made. Reading follows the task's
// own visibility; the assignee and their managers add (the service checks).
export const dynamic = "force-dynamic"

function failure(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode })
  }
  throw err
}

export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, session: Session) => {
    const { id } = await ctx.params
    try {
      return NextResponse.json({ data: await getTaskWork(session, id) })
    } catch (err) {
      return failure(err)
    }
  },
)

export const POST = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, session: Session) => {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    try {
      const out = await addTaskWorkLog(session, id, {
        workedOn: body.workedOn,
        note: body.note,
        quantity: body.quantity,
        links: body.links,
      })
      return NextResponse.json({ data: out }, { status: 201 })
    } catch (err) {
      return failure(err)
    }
  },
)
