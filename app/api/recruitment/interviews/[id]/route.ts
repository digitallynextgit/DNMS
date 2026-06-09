import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const interview = await db.interview.update({
        where: { id: ctx.params.id },
        data: {
          ...(body.result !== undefined && { result: body.result }),
          ...(body.feedback !== undefined && { feedback: body.feedback || null }),
          ...(body.scheduledAt !== undefined && { scheduledAt: new Date(body.scheduledAt) }),
          ...(body.notes !== undefined && { notes: body.notes || null }),
        },
      })
      return NextResponse.json({ data: interview })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      await db.interview.delete({ where: { id: ctx.params.id } })
      return NextResponse.json({ message: "Interview deleted" })
    } catch (error) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
