import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { getDeliverablesOverview } from "@/features/projects/server/deliverables.queries"
import { createDeliverable } from "@/features/projects/server/deliverables.service"
import { STATUS_ORDER, type DeliverableStatus } from "@/features/projects/lib/deliverable-lifecycle"
import { AppError } from "@/lib/errors"

// GET  /api/projects/[id]/deliverables - the ledger + counts for one project
// POST /api/projects/[id]/deliverables - log something that was made, or plan it
//
// READ is open to anyone on the project: what the team produced is the shared
// record of the work. WRITE is any member for their own output; the service
// decides who may log on somebody else's behalf and who may plan work at all.
export const dynamic = "force-dynamic"

/** `?status=DELIVERED,ACCEPTED`. Unknown names are dropped, not 400'd. */
function parseStatuses(raw: string | null): DeliverableStatus[] | undefined {
  if (!raw) return undefined
  const list = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s): s is DeliverableStatus => (STATUS_ORDER as string[]).includes(s))
  return list.length ? list : undefined
}

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    return NextResponse.json({
      data: await getDeliverablesOverview(session, {
        projectId: ctx.params.id!,
        employeeId: q.get("employeeId") ?? undefined,
        teamId: q.get("teamId") ?? undefined,
        type: q.get("type") ?? undefined,
        taskId: q.get("taskId") ?? undefined,
        status: parseStatuses(q.get("status")),
        from: q.get("from"),
        to: q.get("to"),
      }),
    })
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json().catch(() => ({}))
      const created = await createDeliverable(session, ctx.params.id!, body)
      return NextResponse.json({ data: created }, { status: 201 })
    } catch (err) {
      // The service's messages are written for the person filling the form; the
      // code beside it is for the form itself (a locked period is a different
      // conversation from a bad date).
      if (err instanceof AppError) {
        const code = (err.details as { code?: string } | undefined)?.code ?? err.code
        return NextResponse.json({ error: err.message, code }, { status: err.statusCode })
      }
      throw err
    }
  },
)
