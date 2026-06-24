import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { createNotification } from "@/lib/notifications"
import type { Session } from "next-auth"

export const GET = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = req.nextUrl
      const status = searchParams.get("status") ?? undefined
      const assigneeId = searchParams.get("assigneeId") ?? undefined

      const tasks = await db.projectTask.findMany({
        where: {
          projectId: ctx.params.id,
          ...(status && { status: status as never }),
          ...(assigneeId && { assigneeId }),
        },
        orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      return NextResponse.json({ data: tasks })
    } catch (error) {
      console.error("[PROJECT_TASKS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withSession(
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

      const task = await db.projectTask.create({
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
        },
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
