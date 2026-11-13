import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { createMetric, getBoard, metricsAccess } from "@/features/metrics/server/metrics.service"
import { metricsFailure } from "@/features/metrics/server/route-helpers"
import { createMetricSchema } from "@/features/metrics/schemas/metrics.schema"

// The Metrics tab: one week's scorecard, with the week before it for the change column.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const week = req.nextUrl.searchParams.get("week")
      return NextResponse.json({ data: await getBoard(ctx.params.id!, session, week) })
    } catch (e) {
      return metricsFailure(e, "GET")
    }
  },
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await metricsAccess(session, projectId)).canManage) {
      return NextResponse.json({ error: "Only the project managers can add metrics" }, { status: 403 })
    }
    try {
      const input = createMetricSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({ data: await createMetric(projectId, input) }, { status: 201 })
    } catch (e) {
      return metricsFailure(e, "POST")
    }
  },
)
