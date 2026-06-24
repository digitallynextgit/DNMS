import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// PATCH /api/tasks/[id]/checklist/[itemId]
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ itemId: string }> }, _session: Session) => {
    try {
      const { itemId } = await ctx.params
      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (typeof body.isChecked === "boolean") data.isChecked = body.isChecked
      if (body.text?.trim()) data.text = body.text.trim()
      const item = await db.taskChecklistItem.update({ where: { id: itemId }, data })
      return NextResponse.json({ data: item })
    } catch (error) {
      console.error("[CHECKLIST_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE /api/tasks/[id]/checklist/[itemId]
export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ itemId: string }> }, _session: Session) => {
    try {
      const { itemId } = await ctx.params
      await db.taskChecklistItem.delete({ where: { id: itemId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[CHECKLIST_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
