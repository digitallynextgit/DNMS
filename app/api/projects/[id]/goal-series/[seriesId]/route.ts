import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess, canManageProject } from "@/features/projects/server/project-access"
import {
  getSeriesHistory,
  setGoalSeriesStopped,
} from "@/features/projects/server/goal-metrics.service"
import { AppError } from "@/lib/errors"

// A repeating goal: every month's target against reached (anyone on the project), and stopping or
// restarting it (managers - it is a commitment).
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      return NextResponse.json({
        data: await getSeriesHistory(ctx.params.id!, ctx.params.seriesId!),
      })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)

export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    if (!(await canManageProject(session, projectId))) {
      return NextResponse.json(
        { error: "Only project managers can stop or restart a recurring goal" },
        { status: 403 },
      )
    }
    const body = (await req.json().catch(() => ({}))) as { stopped?: unknown }
    if (typeof body.stopped !== "boolean") {
      return NextResponse.json(
        { error: "Say whether it is stopped (true or false)" },
        { status: 400 },
      )
    }
    try {
      await setGoalSeriesStopped(
        projectId,
        ctx.params.seriesId!,
        body.stopped,
        session.user.id ?? null,
      )
      return NextResponse.json({ ok: true })
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
