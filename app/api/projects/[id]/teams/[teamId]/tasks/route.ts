import { NextRequest, NextResponse } from "next/server"
import { expectsOutput } from "@/features/projects/lib/deliverable-types"
import { projectHref } from "@/features/projects/lib/project-href"
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

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId, teamId } = ctx.params
      // teamId is client-chosen: confirm the team is in this project before listing its tasks.
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
          goal: { select: { id: true, title: true } },
          _count: { select: { deliverables: true } },
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

// Self-service, with no approval gate; who may assign to whom is still checked.
export const POST = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { teamId } = ctx.params
      // Plain withSession, so resolve the slug - the id is written onto the task row.
      const projectId = await resolveProjectId(ctx.params.id)
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      const body = await req.json()
      const { title, description, assigneeId, priority, dueDate, estimatedHours, tags } = body
      const { goalId, producesOutput } = body as {
        goalId?: string | null
        producesOutput?: boolean
      }
      const seoPropertyId: string | null = body.seoPropertyId || null

      if (!title || !title.trim()) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 })
      }

      const team = await db.projectTeam.findUnique({
        where: { id: teamId },
        include: {
          members: { select: { employeeId: true } },
          project: { select: { slug: true } },
        },
      })
      if (!team || team.projectId !== projectId) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const isAdmin = await canManageProject(session, projectId)

      const memberIds = team.members.map((m) => m.employeeId)
      if (!memberIds.includes(session.user.id) && !isAdmin) {
        return NextResponse.json(
          { error: "Only team members can create tasks here" },
          { status: 403 },
        )
      }

      const isManager = team.managerId === session.user.id
      const finalAssigneeId = assigneeId || team.managerId || session.user.id

      // Optional (forcing one produces junk goals), but it must be a goal on THIS project.
      const linkedGoalId = goalId
        ? ((
            await db.projectGoal.findFirst({
              where: { id: goalId, projectId },
              select: { id: true },
            })
          )?.id ?? null)
        : null
      if (goalId && !linkedGoalId) {
        return NextResponse.json({ error: "Goal not found on this project" }, { status: 404 })
      }
      // The team's nature decides unless the form said otherwise.
      const outputExpected =
        typeof producesOutput === "boolean" ? producesOutput : expectsOutput(team.name)

      if (finalAssigneeId !== session.user.id && !isManager && !isAdmin) {
        return NextResponse.json(
          { error: "Only the team manager can assign tasks to other members" },
          { status: 403 },
        )
      }

      if (!memberIds.includes(finalAssigneeId)) {
        return NextResponse.json(
          { error: "Assignee must be a member of this team" },
          { status: 422 },
        )
      }

      // Must be one of THIS project's tracked sites.
      if (seoPropertyId) {
        const site = await db.seoProperty.findFirst({
          where: { id: seoPropertyId, projectId },
          select: { id: true },
        })
        if (!site) {
          return NextResponse.json({ error: "Unknown site for this project" }, { status: 422 })
        }
      }

      // Every task is workable at once; isManagerCreated only records who raised it.
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
          goalId: linkedGoalId,
          producesOutput: outputExpected,
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

      try {
        if (isManager && finalAssigneeId !== session.user.id && task.assignee) {
          await createNotification({
            employeeId: finalAssigneeId,
            title: "New task assigned",
            message: `${task.creator.firstName} assigned you: "${task.title}"`,
            type: "info",
            link: "/projects/my-tasks",
          })
          addEmailJob({
            to: task.assignee.email,
            subject: `New task: ${task.title}`,
            html: `<p>Hi ${task.assignee.firstName},</p><p>You've been assigned a new task in <strong>${team.name}</strong>: <strong>${task.title}</strong>.</p>`,
            text: `New task assigned: ${task.title}`,
          })
        } else if (!isManager && team.managerId) {
          // The member planned their own work: the manager is told, not asked.
          await createNotification({
            employeeId: team.managerId,
            title: "New task in your team",
            message: `${task.creator.firstName} added a task in ${team.name}: "${task.title}"`,
            type: "info",
            link: projectHref({ id: projectId, slug: team.project.slug }, "tasks"),
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
