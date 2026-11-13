import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import { metricsAccess, removeMetric, updateMetric } from "@/features/metrics/server/metrics.service"
import { metricsFailure } from "@/features/metrics/server/route-helpers"
import { updateMetricSchema } from "@/features/metrics/schemas/metrics.schema"

async function guard(session: Session, projectId: string) {
  if ((await metricsAccess(session, projectId)).canManage) return null
  return NextResponse.json({ error: "Only the project managers can change metrics" }, { status: 403 })
}

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    const denied = await guard(session, projectId)
    if (denied) return denied
    try {
      const input = updateMetricSchema.parse(await req.json().catch(() => ({})))
      return NextResponse.json({ data: await updateMetric(projectId, ctx.params.metricId!, input) })
    } catch (e) {
      return metricsFailure(e, "PATCH")
    }
  },
)

export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    const denied = await guard(session, projectId)
    if (denied) return denied
    try {
      await removeMetric(projectId, ctx.params.metricId!)
      return NextResponse.json({ data: { ok: true } })
    } catch (e) {
      return metricsFailure(e, "DELETE")
    }
  },
)
