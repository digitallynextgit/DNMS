import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const goal = await db.goal.update({
        where: { id: ctx.params.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.progress !== undefined && { progress: parseInt(body.progress) }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.targetDate !== undefined && {
            targetDate: body.targetDate ? new Date(body.targetDate) : null,
          }),
        },
      })
      return NextResponse.json({ data: goal })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.goal.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "Goal deleted" })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
