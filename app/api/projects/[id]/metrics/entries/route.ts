import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { metricsAccess, saveEntries } from "@/features/metrics/server/metrics.service"
import { metricsFailure } from "@/features/metrics/server/route-helpers"
import { saveEntriesSchema } from "@/features/metrics/schemas/metrics.schema"

// One week's numbers, saved together.
export const PUT = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await metricsAccess(session, projectId)).canManage) {
      return NextResponse.json(
        { error: "Only the project managers can fill the scorecard" },
        { status: 403 },
      )
    }
    try {
      const input = saveEntriesSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({ data: await saveEntries(projectId, session.user.id, input) })
    } catch (e) {
      return metricsFailure(e, "ENTRIES_PUT")
    }
  },
)
