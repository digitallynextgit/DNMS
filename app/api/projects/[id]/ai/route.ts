import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"

import { withProjectAccess } from "@/features/projects/server/project-access"
import {
  explainGoal,
  suggestDeliverables,
  suggestGoalSplit,
  suggestTasks,
  summariseCalendar,
} from "@/features/projects/server/ai-planning.service"
import { AiError, AiNotConfiguredError, isAiConfigured } from "@/lib/ai"
import { AppError } from "@/lib/errors"

// AI planning drafts for one project. GET says whether AI is set up (the buttons hide when not);
// POST { kind, ... } drafts one suggestion - each kind checks its own permission. Nothing is saved
// to the plan from here: people apply a draft through the normal forms.
export const dynamic = "force-dynamic"

export const GET = withProjectAccess(async () =>
  NextResponse.json({ data: { available: await isAiConfigured() } }),
)

export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    const projectId = ctx.params.id!
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = (key: string) => (typeof body[key] === "string" ? (body[key] as string) : "")
    try {
      switch (body.kind) {
        case "goal_split":
          return NextResponse.json({ data: await suggestGoalSplit(session, projectId, body) })
        case "deliverables":
          return NextResponse.json({
            data: await suggestDeliverables(session, projectId, id("goalId")),
          })
        case "tasks":
          return NextResponse.json({
            data: await suggestTasks(session, projectId, id("deliverableId")),
          })
        case "explain_goal":
          return NextResponse.json({ data: await explainGoal(session, projectId, id("goalId")) })
        case "calendar":
          return NextResponse.json({
            data: await summariseCalendar(projectId, id("workbookId"), body.refresh === true),
          })
        default:
          return NextResponse.json({ error: "Unknown suggestion kind" }, { status: 400 })
      }
    } catch (err) {
      if (err instanceof AiNotConfiguredError) {
        return NextResponse.json({ error: "AI is not set up for this app yet." }, { status: 503 })
      }
      if (err instanceof AiError) {
        return NextResponse.json({ error: err.message }, { status: err.status === 429 ? 429 : 502 })
      }
      if (err instanceof AppError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }
  },
)
