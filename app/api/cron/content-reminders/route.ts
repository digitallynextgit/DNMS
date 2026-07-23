import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import { contentTaskTitle } from "@/features/projects/server/content-task.service"

// Reminds people about the content they are supposed to publish:
//   - due TODAY and not yet posted  -> "publish today"
//   - past due and still not posted -> "overdue"
// Notifications go through lib/notifications, so these arrive as web push even
// when the tab is closed.
//
// Run daily (morning). Auth: Authorization: Bearer <CRON_SECRET>

export const runtime = "nodejs"

/** Today at UTC midnight - `date` is a @db.Date, so it stores that way too. */
function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const today = todayUtc()

    const entries = await db.contentCalendarEntry.findMany({
      where: {
        assigneeId: { not: null },
        status: { not: "POSTED" },
        date: { not: null, lte: today },
      },
      select: {
        id: true,
        projectId: true,
        date: true,
        platform: true,
        format: true,
        theme: true,
        status: true,
        remindedAt: true,
        assigneeId: true,
        project: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    })

    let dueToday = 0
    let overdue = 0
    let notified = 0

    for (const e of entries) {
      if (!e.date || !e.assigneeId) continue
      const isToday = e.date.getTime() === today.getTime()

      // Due today: remind once. Overdue: remind once a day, since it's now a
      // problem rather than a heads-up.
      const alreadyToday =
        e.remindedAt !== null &&
        e.remindedAt.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
      if (alreadyToday) continue
      if (isToday && e.remindedAt !== null) continue

      const title = contentTaskTitle(e)
      if (isToday) {
        dueToday++
        await createNotification({
          employeeId: e.assigneeId,
          title: "Publish today",
          message: `${e.project.name} — ${title}`,
          type: "info",
          link: `/projects/${e.projectId}?tab=brand`,
        })
      } else {
        overdue++
        const days = Math.round((today.getTime() - e.date.getTime()) / 86_400_000)
        await createNotification({
          employeeId: e.assigneeId,
          title: `Content overdue by ${days} day${days > 1 ? "s" : ""}`,
          message: `${e.project.name} — ${title} was due ${e.date.toISOString().slice(0, 10)}.`,
          type: "warning",
          link: `/projects/${e.projectId}?tab=brand`,
        })
      }
      notified++
      await db.contentCalendarEntry.update({
        where: { id: e.id },
        data: { remindedAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      considered: entries.length,
      dueToday,
      overdue,
      notified,
    })
  } catch (error) {
    console.error("[CONTENT_REMINDERS_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
