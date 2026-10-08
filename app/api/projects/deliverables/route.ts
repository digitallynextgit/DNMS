import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withSession } from "@/server/api-handler"
import { getDeliverablesOverview } from "@/features/projects/server/deliverables.queries"
import { STATUS_ORDER, type DeliverableStatus } from "@/features/projects/lib/deliverable-lifecycle"

// Static segment beside [id]; Next resolves the literal path first, so it doesn't shadow /api/projects/<id>.
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

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    const q = req.nextUrl.searchParams
    return NextResponse.json({
      data: await getDeliverablesOverview(session, {
        projectId: q.get("projectId") ?? undefined,
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
