import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { removeEntryTask, syncEntryTask } from "@/features/projects/server/content-task.service"
import type { Session } from "next-auth"

const serialize = <T extends { date: Date | null }>(e: T) => ({
  ...e,
  date: e.date ? e.date.toISOString().slice(0, 10) : null,
})

const FIELDS = ["platform", "theme", "format", "hook", "content", "status", "link"] as const

// PATCH - update one entry, then reconcile its mirrored task.
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id, entryId } = ctx.params
      const existing = await db.contentCalendarEntry.findUnique({ where: { id: entryId } })
      if (!existing || existing.projectId !== id)
        return NextResponse.json({ error: "Not found" }, { status: 404 })

      const b = await req.json().catch(() => ({}))
      const data: Record<string, unknown> = {}
      if ("date" in b) data.date = b.date ? new Date(b.date) : null
      if ("assigneeId" in b) data.assigneeId = b.assigneeId || null
      for (const f of FIELDS) if (f in b) data[f] = b[f] || (f === "status" ? "PLANNED" : null)

      // A rescheduled post deserves a fresh reminder on its new date.
      if ("date" in b && (b.date || null) !== (existing.date?.toISOString().slice(0, 10) ?? null)) {
        data.remindedAt = null
      }

      const entry = await db.contentCalendarEntry.update({ where: { id: entryId }, data })
      const taskId = await syncEntryTask(entry, session.user.id)
      return NextResponse.json({ data: serialize({ ...entry, taskId }) })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE - remove one entry and the task it created.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const { id, entryId } = ctx.params
      const existing = await db.contentCalendarEntry.findUnique({ where: { id: entryId } })
      if (!existing || existing.projectId !== id)
        return NextResponse.json({ error: "Not found" }, { status: 404 })

      // Entry first: the task FK is ON DELETE SET NULL, so the entry's pointer
      // would be cleared before we could read it the other way round.
      await db.contentCalendarEntry.delete({ where: { id: entryId } })
      await removeEntryTask(existing.taskId)
      return NextResponse.json({ data: { ok: true } })
    } catch (error) {
      console.error("[CONTENT_CALENDAR_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
