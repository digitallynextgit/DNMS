import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, withProjectManager } from "@/features/projects/server/project-access"
import { createNotification } from "@/lib/notifications"
import { openFirstStatusPeriod } from "@/features/projects/server/task-status-periods"
import type { Session } from "next-auth"

/** Most tasks returned for one project board. Reported via meta.truncated. */
const PROJECT_TASK_LIMIT = 2000

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = req.nextUrl
      const status = searchParams.get("status") ?? undefined
      const assigneeId = searchParams.get("assigneeId") ?? undefined

      // Bounded, and the two @db.Text columns no list consumer reads are
      // omitted - the board used to pull every task on the project with every
      // wide column via `include`.
      const rows = await db.projectTask.findMany({
        where: {
          projectId: ctx.params.id,
          ...(status && { status: status as never }),
          ...(assigneeId && { assigneeId }),
        },
        orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: PROJECT_TASK_LIMIT + 1,
        omit: { holdReason: true, discardReason: true },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
          requirement: { select: { id: true, title: true, status: true } },
        },
      })
      const truncated = rows.length > PROJECT_TASK_LIMIT
      if (truncated) rows.length = PROJECT_TASK_LIMIT

      return NextResponse.json({
        data: rows,
        meta: { truncated, limit: PROJECT_TASK_LIMIT },
      })
    } catch (error) {
      console.error("[PROJECT_TASKS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const {
        title,
        description,
        status,
        priority,
        assigneeId,
        startDate,
        dueDate,
        estimatedHours,
        tags,
      } = body

      // One transaction - see the same fix in app/api/tasks/route.ts. A task and
      // its first status period must be created together or the "exactly one
      // open period" invariant can be left broken with no repair path.
      const task = await db.$transaction(async (tx) => {
        const created = await tx.projectTask.create({
          data: {
            projectId: ctx.params.id,
            title,
            description: description || null,
            status: (status ?? "TODO") as never,
            priority: (priority ?? "MEDIUM") as never,
            assigneeId: assigneeId ?? null,
            creatorId: session.user.id,
            startDate: startDate ? new Date(startDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
            tags: tags ?? [],
          },
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
            creator: { select: { id: true, firstName: true, lastName: true } },
            requirement: { select: { id: true, title: true, status: true } },
          },
        })

        await openFirstStatusPeriod(tx, {
          taskId: created.id,
          status: created.status,
          actorId: session.user.id,
          at: created.createdAt,
        })

        return created
      })

      // Notify assignee if assigned to someone other than the creator
      if (task.assigneeId && task.assigneeId !== session.user.id) {
        const project = await db.project.findUnique({
          where: { id: ctx.params.id },
          select: { name: true },
        })
        await createNotification({
          employeeId: task.assigneeId,
          title: "New Task Assigned",
          message: `You have been assigned "${task.title}" in project ${project?.name ?? "a project"}.`,
          type: "info",
          link: `/projects/${ctx.params.id}`,
        })
      }

      return NextResponse.json({ data: task }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_TASKS_POST]", error)
      const message = error instanceof Error ? error.message : "Internal server error"
      return NextResponse.json({ error: message }, { status: 500 })
    }
  },
)
