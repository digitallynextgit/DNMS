import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getTaskReminderPreference } from "@/features/notifications/server/task-reminder.queries"
import { saveTaskReminderPreference } from "@/features/notifications/server/task-reminder.service"
import type { Session } from "next-auth"

// Always self-scoped: the employee id comes from the session, never the request.

export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await getTaskReminderPreference(session.user.id)),
)

export const PATCH = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await saveTaskReminderPreference(session.user.id, await req.json())),
)
