import { NextRequest, NextResponse } from "next/server"
import {
  canManageProject,
  resolveProjectId,
  withProjectAccess,
} from "@/features/projects/server/project-access"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { logActivity } from "@/features/projects/server/activity"
import { PERMISSIONS } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"
import { addEmailJob } from "@/lib/queue"
import { createAuditLog } from "@/lib/audit"
import { openFirstStatusPeriod } from "@/features/projects/server/task-status-periods"
import type { Session } from "next-auth"

// GET /api/projects/[id]/teams/[teamId]/tasks - list tasks for team (all project members can view)
export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      // withProjectAccess validated the URL project only; teamId is client-chosen.
      // Confirm the team lives in this project before listing its tasks, or A can
      // read any other project's task board. Matches the POST guard below.
      const team = await db.projectTeam.findFirst({
        where: { id: teamId, projectId },
        select: { id: true },
      })
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 })
      const tasks = await db.projectTask.findMany({
        where: { teamId },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
          requirement: { select: { id: true, title: true, status: true } },
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
//
// Tasks are self-service: a member plans their own week and starts on it. There
// is no approval gate - a self-raised task used to land in PENDING_APPROVAL and
// sit there unworkable until the team manager noticed it, which only delayed
// work the person had already committed to. Who may assign to WHOM is still
// checked above; only the approval step is gone.
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { teamId } = ctx.params
      // The URL carries a slug now; this route is behind plain withSession, not
      // a slug-aware guard. The id is WRITTEN onto the created task, so an
      // unresolved slug would corrupt the row, not merely 404.
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
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

      // Every task is workable the moment it is raised. isManagerCreated still
      // records WHO raised it, because "my manager gave me this" and "I planned
      // this myself" read differently in a history, but neither one waits.
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
          approvalStatus: "APPROVED",
          isManagerCreated,
          seoPropertyId,
        },
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
          creator: { select: { id: true, firstName: true, lastName: true } },
        },
      })

      await openFirstStatusPeriod(db, {
        taskId: task.id,
        status: task.status,
        actorId: session.user.id,
        at: task.createdAt,
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
          // Member planned their own work. The manager is told, not asked -
          // they still want to know what their team put on this week.
          await createNotification({
            employeeId: team.managerId,
            title: "New task in your team",
            message: `${task.creator.firstName} added a task in ${team.name}: "${task.title}"`,
            type: "info",
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
