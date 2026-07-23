import { NextRequest, NextResponse } from "next/server"
import { canManageProject, withProjectAccess } from "@/features/projects/server/project-access"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { logActivity } from "@/features/projects/server/activity"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// GET /api/projects/[id]/teams/[teamId]/tasks - list tasks for team (all project members can view)
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { teamId } = ctx.params
      const tasks = await db.projectTask.findMany({
        where: { teamId },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
      })
      return NextResponse.json({ data: tasks })
    } catch (error) {
      console.error("[TEAM_TASKS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST /api/projects/[id]/teams/[teamId]/tasks - create task
// Manager-created (assigneeId !== caller) → APPROVED + isManagerCreated=true
// Self-task (assigneeId === caller OR not set) → PENDING_APPROVAL (unless caller IS the manager)
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      const body = await req.json()
      const { title, description, assigneeId, priority, dueDate, estimatedHours, tags } = body
      const seoPropertyId: string | null = body.seoPropertyId || null

      if (!title || !title.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 })
      }

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: { members: { select: { employeeId: true } } },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      // Admin override
      const isAdmin = await canManageProject(session, projectId)

      // Caller must be a team member OR admin
      const memberIds = team.members.map((m) => m.employeeId)
      if (!memberIds.includes(session.user.id) && !isAdmin) {
        return NextResponse.json(
          { error: "Only team members can create tasks here" },
          { status: 403 },
        )
      }

      const isManager = team.managerId === session.user.id
      const finalAssigneeId = assigneeId || team.managerId || session.user.id

      // If assigning to someone else, must be manager OR admin
      if (finalAssigneeId !== session.user.id && !isManager && !isAdmin) {
        return NextResponse.json(
          { error: "Only the team manager can assign tasks to other members" },
          { status: 403 },
        )
      }

      // Assignee must be a team member (unless admin is creating - they may assign to manager who must be in team)
      if (!memberIds.includes(finalAssigneeId)) {
        return NextResponse.json(
          { error: "Assignee must be a member of this team" },
          { status: 422 },
        )
      }

      // A task can be scoped to one of the project's tracked sites. Verify it
      // belongs to THIS project so a stray id can't attach work to another
      // client's subdomain.
      if (seoPropertyId) {
        const site = await db.seoProperty.findFirst({
          where: { id: seoPropertyId, projectId },
          select: { id: true },
        })
        if (!site) {
          return NextResponse.json({ error: "Unknown site for this project" }, { status: 422 })
        }
      }

      // Determine approval status
      // Manager OR admin creates → APPROVED. Member creates self-task → PENDING_APPROVAL.
      const approvalStatus = isManager || isAdmin ? "APPROVED" : "PENDING_APPROVAL"
      const isManagerCreated = isManager || isAdmin

      const task = await db.projectTask.create({
        data: {
          projectId,
          teamId,
          title: title.trim(),
          description: description?.trim() || null,
          status: "TODO",
          priority: priority || "MEDIUM",
          assigneeId: finalAssigneeId,
          creatorId: session.user.id,
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedHours: estimatedHours ? Number(estimatedHours) : null,
          tags: Array.isArray(tags) ? tags : [],
          approvalStatus,
          isManagerCreated,
          seoPropertyId,
        },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      // Notifications
      try {
        if (isManager && finalAssigneeId !== session.user.id && task.assignee) {
          // Manager assigned to another member
          await createNotification({
            employeeId: finalAssigneeId,
            title: "New task assigned",
            message: `${task.creator.firstName} assigned you: "${task.title}"`,
            type: "info",
            link: `/projects/${projectId}`,
          })
          addEmailJob({
            to: task.assignee.email,
            subject: `New task: ${task.title}`,
            html: `<p>Hi ${task.assignee.firstName},</p><p>You've been assigned a new task in <strong>${team.name}</strong>: <strong>${task.title}</strong>.</p>`,
            text: `New task assigned: ${task.title}`,
          })
        } else if (!isManager && team.managerId) {
          // Member self-created task - notify manager for approval
          await createNotification({
            employeeId: team.managerId,
            title: "Task pending approval",
            message: `${task.creator.firstName} created a self-task: "${task.title}"`,
            type: "warning",
            link: `/projects/${projectId}`,
          })
        }
      } catch (_e) {
        /* non-blocking */
      }

      await createAuditLog(session, {
        action: "CREATE",
        module: "project",
        entityType: "ProjectTask",
        entityId: task.id,
        changes: {
          teamId,
          title: task.title,
          assigneeId: finalAssigneeId,
          approvalStatus,
          isManagerCreated,
          seoPropertyId,
        },
      })

      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "TASK_CREATED",
        entityType: "TASK",
        entityId: task.id,
        meta: { taskTitle: task.title, teamId, assigneeId: finalAssigneeId },
      })

      return NextResponse.json({ data: task }, { status: 201 })
    } catch (error) {
      console.error("[TEAM_TASKS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
