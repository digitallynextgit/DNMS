import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/mailer"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// PATCH /api/tasks/[id]/approve - Manager (of the task's team) or Admin
export const PATCH = withSession(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id } = ctx.params

      const task = await db.projectTask.findUnique({
        where: { id },
        include: {
          team: { select: { id: true, name: true, managerId: true, projectId: true } },
          assignee: { select: { id: true, firstName: true, email: true } },
        },
      })
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })
      if (task.approvalStatus !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "Only pending tasks can be approved" }, { status: 409 })
      }

      const isManager = task.team?.managerId === session.user.id
      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      if (!isManager && !isAdmin) {
        return NextResponse.json({ error: "Only the team manager can approve" }, { status: 403 })
      }

      const updated = await db.projectTask.update({
        where: { id },
        data: { approvalStatus: "APPROVED", rejectionReason: null },
      })

      // Notify the assignee
      try {
        if (task.assignee) {
          await createNotification({
            employeeId: task.assignee.id,
            title: "Task approved",
            message: `Your task "${task.title}" has been approved.`,
            type: "success",
            link: `/projects/${task.team!.projectId}`,
          })
          await sendEmail({
            to: task.assignee.email,
            subject: `Task approved: ${task.title}`,
            html: `<p>Hi ${task.assignee.firstName},</p><p>Your self-task <strong>${task.title}</strong> has been approved. You can start working on it.</p>`,
            text: `Task approved: ${task.title}`,
          })
        }
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: "APPROVE",
        module: "project",
        entityType: "ProjectTask",
        entityId: id,
        changes: { from: "PENDING_APPROVAL", to: "APPROVED" },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[TASK_APPROVE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
