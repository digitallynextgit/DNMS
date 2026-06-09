import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

// GET /api/tasks/[id]/checklist
export const GET = withSession(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }, _session: Session) => {
    try {
      const { id: taskId } = await ctx.params
      const items = await db.taskChecklistItem.findMany({
        where: { taskId },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      })
      return NextResponse.json({ data: items })
    } catch (error) {
      console.error("[CHECKLIST_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/tasks/[id]/checklist
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }, _session: Session) => {
    try {
      const { id: taskId } = await ctx.params
      const task = await db.projectTask.findUnique({ where: { id: taskId }, select: { id: true } })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      const body = await req.json()
      const text = body.text?.trim()
      if (!text) return NextResponse.json({ error: "Text is required" }, { status: 400 })

      const last = await db.taskChecklistItem.findFirst({
        where: { taskId },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true },
      })

      const item = await db.taskChecklistItem.create({
        data: { taskId, text, displayOrder: (last?.displayOrder ?? 0) + 1 },
      })
      return NextResponse.json({ data: item }, { status: 201 })
    } catch (error) {
      console.error("[CHECKLIST_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
