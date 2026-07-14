import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

const serialize = (e: { date: Date | null }) => ({
  ...e,
  date: e.date ? e.date.toISOString().slice(0, 10) : null,
})

const FIELDS = ["platform", "theme", "format", "hook", "content", "status", "link"] as const

// PATCH - update one entry.
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id, entryId } = ctx.params
      const existing = await db.contentCalendarEntry.findUnique({ where: { id: entryId } })
      if (!existing || existing.projectId !== id)
        return NextResponse.json({ error: "Not found" }, { status: 404 })

      const b = await req.json().catch(() => ({}))
      const data: Record<string, unknown> = {}
      if ("date" in b) data.date = b.date ? new Date(b.date) : null
      for (const f of FIELDS) if (f in b) data[f] = b[f] || (f === "status" ? "PLANNED" : null)

      const entry = await db.contentCalendarEntry.update({ where: { id: entryId }, data })
      return NextResponse.json({ data: serialize(entry) })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE - remove one entry.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const { id, entryId } = ctx.params
      const existing = await db.contentCalendarEntry.findUnique({ where: { id: entryId } })
      if (!existing || existing.projectId !== id)
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      await db.contentCalendarEntry.delete({ where: { id: entryId } })
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
