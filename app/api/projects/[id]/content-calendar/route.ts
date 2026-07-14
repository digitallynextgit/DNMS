import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

type Entry = {
  id: string
  date: Date | null
  platform: string | null
  theme: string | null
  format: string | null
  hook: string | null
  content: string | null
  status: string
  link: string | null
}
const serialize = (e: Entry) => ({ ...e, date: e.date ? e.date.toISOString().slice(0, 10) : null })

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
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
      return NextResponse.json({ data: entries.map(serialize) })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST - create one entry.
export const POST = withAuth(
  PERMISSIONS.PROJECT_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
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
        },
      })
      return NextResponse.json({ data: serialize(entry) }, { status: 201 })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
