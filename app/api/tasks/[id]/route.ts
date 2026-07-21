import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { logActivity } from "@/features/projects/server/activity"
import { createNotification } from "@/lib/notifications"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Permission helper: returns roles for the current user against a task
async function getTaskAuthContext(taskId: string, userId: string) {
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    include: {
      team: { select: { id: true, managerId: true, projectId: true } },
    },
  })
  if (!task) return null
  return {
    task,
    isAssignee: task.assigneeId === userId,
    isManager: task.team?.managerId === userId,
  }
}

export const PATCH = withSession(
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
        loggedHours,
        tags,
        isMilestone,
        holdReason,
        holdExpectedDate,
        discardReason,
      } = body

      const auth = await getTaskAuthContext(ctx.params.id, session.user.id)
      if (!auth) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

      // Only assignee, manager, or admin may modify
      if (!auth.isAssignee && !auth.isManager && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Members can only change status of their own tasks; everything else needs manager
      const isStructuralChange =
        title !== undefined ||
        description !== undefined ||
        priority !== undefined ||
        assigneeId !== undefined ||
        startDate !== undefined ||
        dueDate !== undefined ||
        estimatedHours !== undefined ||
        tags !== undefined
      if (isStructuralChange && !auth.isManager && !isAdmin) {
        return NextResponse.json(
          { error: "Only the team manager can edit task details. You can update status only." },
          { status: 403 },
        )
      }

      const data: Record<string, unknown> = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (status !== undefined) {
        data.status = status
        data.completedAt = status === "DONE" ? new Date() : null
        if (status === "ON_HOLD") {
          const reason = (holdReason ?? "").toString().trim()
          if (!reason)
            return NextResponse.json(
              { error: "A reason is required to put a task on hold." },
              { status: 422 },
            )
          if (!holdExpectedDate)
            return NextResponse.json(
              { error: "An expected completion date is required to put a task on hold." },
              { status: 422 },
            )
          data.holdReason = reason
          data.holdExpectedDate = new Date(holdExpectedDate)
          data.discardReason = null
        } else if (status === "DISCARDED") {
          const reason = (discardReason ?? "").toString().trim()
          if (!reason)
            return NextResponse.json(
              { error: "A reason is required to discard a task." },
              { status: 422 },
            )
          data.discardReason = reason
          data.holdReason = null
          data.holdExpectedDate = null
        } else {
          // Any other status clears prior hold/discard context.
          data.holdReason = null
          data.holdExpectedDate = null
          data.discardReason = null
        }
      }
      if (priority !== undefined) data.priority = priority
      if (assigneeId !== undefined) data.assigneeId = assigneeId ?? null
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
      if (estimatedHours !== undefined)
        data.estimatedHours = estimatedHours ? parseFloat(estimatedHours) : null
      if (loggedHours !== undefined) data.loggedHours = parseFloat(loggedHours)
      if (tags !== undefined) data.tags = tags
      if (typeof isMilestone === "boolean") data.isMilestone = isMilestone

      const prevStatus = auth.task.status

      const task = await db.projectTask.update({
        where: { id: ctx.params.id },
        data,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      })

      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectTask",
        entityId: ctx.params.id,
        changes: data as object,
      })

      const projectId = auth.task.team?.projectId ?? auth.task.projectId
      if (status !== undefined && status !== prevStatus) {
        await logActivity({
          projectId,
          actorId: session.user.id,
          type: "TASK_STATUS_CHANGED",
          entityType: "TASK",
          entityId: task.id,
          meta: { taskTitle: task.title, from: prevStatus, to: status },
        })

        // Notify the team manager on the key transitions.
        const mgrId = auth.task.team?.managerId
        if (mgrId && mgrId !== session.user.id) {
          const who = task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : "Someone"
          const notif =
            status === "DONE"
              ? {
                  title: "Task completed",
                  message: `${who} completed "${task.title}"`,
                  type: "success" as const,
                }
              : status === "ON_HOLD"
                ? {
                    title: "Task put on hold",
                    message: `${who} put "${task.title}" on hold - ${data.holdReason}`,
                    type: "info" as const,
                  }
                : status === "DISCARDED"
                  ? {
                      title: "Task discarded",
                      message: `${who} discarded "${task.title}" - ${data.discardReason}`,
                      type: "error" as const,
                    }
                  : null
          if (notif) {
            await createNotification({
              employeeId: mgrId,
              ...notif,
              link: `/projects/${projectId}`,
            })
          }
        }
      } else if (typeof isMilestone === "boolean") {
        await logActivity({
          projectId,
          actorId: session.user.id,
          type: "MILESTONE_TOGGLED",
          entityType: "TASK",
          entityId: task.id,
          meta: { taskTitle: task.title, isMilestone },
        })
      }

      return NextResponse.json({ data: task })
    } catch (error) {
      console.error("[TASK_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const DELETE = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const auth = await getTaskAuthContext(ctx.params.id, session.user.id)
      if (!auth) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      if (!auth.isManager && !isAdmin) {
        return NextResponse.json(
          { error: "Only the team manager can delete tasks" },
          { status: 403 },
        )
      }

      await db.projectTask.delete({ where: { id: ctx.params.id } })

      await createAuditLog(session, {
        action: "DELETE",
        module: "project",
        entityType: "ProjectTask",
        entityId: ctx.params.id,
        changes: { title: auth.task.title },
      })

      return NextResponse.json({ message: "Task deleted" })
    } catch (error) {
      console.error("[TASK_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
