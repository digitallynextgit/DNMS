import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import { resolveTaskManagerId } from "@/features/projects/lib/task-permissions"
import type { Session } from "next-auth"

// PATCH /api/tasks/[id]/reject - Manager rejects a PENDING_APPROVAL task
export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()
      const { reason } = body
      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
      }

      const task = await db.projectTask.findUnique({
        where: { id },
        include: {
          team: { select: { id: true, name: true, managerId: true, projectId: true } },
          assignee: { select: { id: true, firstName: true, email: true, managerId: true } },
        },
      })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
      if (task.approvalStatus !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "Only pending tasks can be rejected" }, { status: 409 })
      }

      // Adhoc work has no team, so the assignee's line manager decides.
      const managerId = resolveTaskManagerId({
        teamId: task.teamId,
        teamManagerId: task.team?.managerId,
        assigneeManagerId: task.assignee?.managerId,
      })
      const isManager = !!managerId && managerId === session.user.id
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      if (!isManager && !isAdmin) {
        return NextResponse.json({ error: "Only the manager can reject" }, { status: 403 })
      }

      const updated = await db.projectTask.update({
        where: { id },
        data: { approvalStatus: "REJECTED", rejectionReason: reason.trim() },
      })

      // Notify creator/assignee
      try {
        if (task.assignee) {
          await createNotification({
            employeeId: task.assignee.id,
            title: "Task rejected",
            message: `Your task "${task.title}" was rejected. Reason: ${reason.trim()}`,
            type: "error",
            link: task.projectId ? `/projects/${task.projectId}` : "/projects/my-tasks",
          })
          addEmailJob({
            to: task.assignee.email,
            subject: `Task rejected: ${task.title}`,
            html: `<p>Hi ${task.assignee.firstName},</p><p>Your self-task <strong>${task.title}</strong> was rejected.</p><p><strong>Reason:</strong> ${reason.trim()}</p>`,
            text: `Task rejected: ${task.title}. Reason: ${reason.trim()}`,
          })
        }
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: "REJECT",
        module: "project",
        entityType: "ProjectTask",
        entityId: id,
        changes: { from: "PENDING_APPROVAL", to: "REJECTED", reason: reason.trim() },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[TASK_REJECT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
