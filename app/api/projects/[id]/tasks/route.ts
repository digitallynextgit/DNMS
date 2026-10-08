import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import {
  canManageProject,
  canStaffTeam,
  withProjectAccess,
  withTeamStaffing,
} from "@/features/projects/server/project-access"
import { createNotification } from "@/lib/notifications"
import { openFirstStatusPeriod } from "@/features/projects/server/task-status-periods"
import { expectsOutput } from "@/features/projects/lib/deliverable-types"
import type { Session } from "next-auth"

/** Most tasks returned for one project board. Reported via meta.truncated. */
const PROJECT_TASK_LIMIT = 2000

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = req.nextUrl
      const status = searchParams.get("status") ?? undefined
      const assigneeId = searchParams.get("assigneeId") ?? undefined

      // Bounded, and skips the two @db.Text columns no list consumer reads.
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
          goal: { select: { id: true, title: true } },
          _count: { select: { deliverables: true } },
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

// With a teamId: a team manager planning their team's work (staffing guard). Without one: a
// project-level task, which stays with the project manager (the branch below).
export const POST = withTeamStaffing(
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
        goalId,
        teamId,
        producesOutput,
      } = body

      // The team must be on THIS project and staffed by this person.
      const team = teamId
        ? await db.projectTeam.findFirst({
            where: { id: String(teamId), projectId: ctx.params.id },
            select: { id: true, name: true },
          })
        : null
      if (teamId) {
        if (!team) {
          return NextResponse.json({ error: "Team not found on this project" }, { status: 404 })
        }
        if (!(await canStaffTeam(session, ctx.params.id, team.id))) {
          return NextResponse.json({ error: "You do not manage that team" }, { status: 403 })
        }
      } else if (!(await canManageProject(session, ctx.params.id))) {
        return NextResponse.json(
          { error: "Only the Account Manager or a project admin can raise a project-level task" },
          { status: 403 },
        )
      }

      // The goal this work serves, when given: must be one of THIS project's.
      const linkedGoalId = goalId
        ? ((
            await db.projectGoal.findFirst({
              where: { id: String(goalId), projectId: ctx.params.id },
              select: { id: true },
            })
          )?.id ?? null)
        : null
      if (goalId && !linkedGoalId) {
        return NextResponse.json({ error: "Goal not found on this project" }, { status: 404 })
      }

      // One transaction: a task and its first status period are created together.
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
            goalId: linkedGoalId,
            teamId: team?.id ?? null,
            // The team's vocabulary decides the default (see expectsOutput); a project-level task assumes output.
            producesOutput:
              typeof producesOutput === "boolean"
                ? producesOutput
                : team
                  ? expectsOutput(team.name)
                  : true,
          },
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
            creator: { select: { id: true, firstName: true, lastName: true } },
            requirement: { select: { id: true, title: true, status: true } },
            goal: { select: { id: true, title: true } },
            _count: { select: { deliverables: true } },
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
          // My Tasks is the only view that shows the task they were just handed.
          link: "/projects/my-tasks",
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
