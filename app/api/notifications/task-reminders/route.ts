import { NextRequest } from "next/server"
import { withSession } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { getTaskReminderPreference } from "@/features/notifications/server/task-reminder.queries"
import { saveTaskReminderPreference } from "@/features/notifications/server/task-reminder.service"
import type { Session } from "next-auth"

// The caller's OWN task-reminder settings. Always self-scoped - the employee id
// comes from the session and is never read off the request, so there is no way
// to read or rewrite somebody else's preferences.

// GET /api/notifications/task-reminders
export const GET = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await getTaskReminderPreference(session.user.id)),
)

// PATCH /api/notifications/task-reminders
// { enabled, leadMinutes, reminderCount, repeatEveryMinutes }
// Invalid numbers throw a ZodError, which withSession turns into a 422 carrying
// the per-field messages the form shows.
export const PATCH = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) =>
    ok(await saveTaskReminderPreference(session.user.id, await req.json())),
)
