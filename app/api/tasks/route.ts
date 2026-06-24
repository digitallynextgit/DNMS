import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// GET /api/tasks?mine=true - all tasks assigned to the current user
export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const mine = searchParams.get("mine") === "true"
    const status = searchParams.get("status") ?? undefined

    const tasks = await db.projectTask.findMany({
      where: {
        ...(mine && { assigneeId: session.user.id }),
        ...(status && { status: status as never }),
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      include: {
        project: { select: { id: true, name: true, code: true } },
        team: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
      },
    })

    return NextResponse.json({ data: tasks })
  } catch (error) {
    console.error("[TASKS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
