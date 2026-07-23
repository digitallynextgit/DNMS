import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"
import { syncEntryTask } from "@/features/projects/server/content-task.service"
import type { Session } from "next-auth"

type Entry = {
  id: string
  date: Date | null
  assigneeId: string | null
  taskId: string | null
  platform: string | null
  theme: string | null
  format: string | null
  hook: string | null
  content: string | null
  status: string
  link: string | null
  assignee?: { id: string; firstName: string; lastName: string } | null
}
// Generic so it also accepts the full row returned by create() (which carries
// projectId/timestamps the list select omits).
const serialize = <T extends { date: Date | null }>(e: T) => ({
  ...e,
  date: e.date ? e.date.toISOString().slice(0, 10) : null,
})

// Only the columns the calendar renders (no createdAt/updatedAt/projectId), and a
// hard cap so an un-filtered (no ?month) read can never fetch the whole table -
// `hook`/`content` are @db.Text and dominate the payload.
const ENTRY_SELECT = {
  id: true,
  date: true,
  assigneeId: true,
  taskId: true,
  platform: true,
  theme: true,
  format: true,
  hook: true,
  content: true,
  status: true,
  link: true,
  assignee: { select: { id: true, firstName: true, lastName: true } },
} as const
const MAX_ENTRIES = 500

// GET - content-calendar entries (optional ?month=YYYY-MM & ?platform=).
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const projectId = ctx.params.id
      const month = req.nextUrl.searchParams.get("month")
      const platform = req.nextUrl.searchParams.get("platform")
      const where: Record<string, unknown> = { projectId }
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [y, m] = month.split("-").map(Number)
        where.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lte: new Date(Date.UTC(y, m, 0)) }
      }
      if (platform) where.platform = platform
      const entries = await db.contentCalendarEntry.findMany({
        where,
        select: ENTRY_SELECT,
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        take: MAX_ENTRIES,
      })
      return NextResponse.json({ data: entries.map(serialize) })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST - create one entry.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const projectId = ctx.params.id
      const b = await req.json().catch(() => ({}))
      const entry = await db.contentCalendarEntry.create({
        data: {
          projectId,
          date: b.date ? new Date(b.date) : null,
          platform: b.platform || null,
          theme: b.theme || null,
          format: b.format || null,
          hook: b.hook || null,
          content: b.content || null,
          status: b.status || "PLANNED",
          link: b.link || null,
          assigneeId: b.assigneeId || null,
        },
      })
      // An assigned post becomes a real task on that person's board.
      const taskId = await syncEntryTask(entry, session.user.id)
      return NextResponse.json({ data: serialize({ ...entry, taskId }) }, { status: 201 })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
