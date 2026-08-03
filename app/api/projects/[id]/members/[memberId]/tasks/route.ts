import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// GET /api/projects/[id]/members/[memberId]/tasks
//
// One person's tasks on ONE project, for the member drill-down on the progress
// view. Guarded by withProjectAccess, so it only ever answers for a project the
// caller can already see - deliberately narrower than /api/tasks.
//
// Accepts the same optional from/to due-date window as the rest of the progress
// surface, so the drill-down agrees with the row you clicked.
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, memberId } = ctx.params
      const { searchParams } = req.nextUrl
      const from = searchParams.get("from")
      const to = searchParams.get("to")

      const dueRange =
        from || to
          ? {
              dueDate: {
                ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
                ...(to && { lte: new Date(`${to}T23:59:59.999Z`) }),
              },
            }
          : {}

      const tasks = await db.projectTask.findMany({
        where: {
          projectId,
          assigneeId: memberId,
          approvalStatus: { not: "REJECTED" },
          ...dueRange,
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          completedAt: true,
          estimatedHours: true,
          loggedHours: true,
          inProgressSince: true,
          team: { select: { id: true, name: true } },
        },
      })

      return NextResponse.json({ data: tasks })
    } catch (error) {
      console.error("[PROJECT_MEMBER_TASKS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
