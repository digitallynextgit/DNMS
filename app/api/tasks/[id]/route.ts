import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { logActivity } from "@/features/projects/server/activity"
import { recordStatusChange } from "@/features/projects/server/task-status-periods"
import {
  upsertResumeTask,
  removeResumeTaskIfPristine,
  canRemoveUntouchedFollowUp,
  type ResumeTaskResult,
} from "@/features/projects/server/task-hold.service"
import { settleRunningTasks } from "@/features/projects/server/task-clock.service"
import { diffTaskFields } from "@/features/projects/server/task-audit"
import { dedupeLinks, isSafeHttpUrl } from "@/features/projects/lib/task-links"
import { projectHref } from "@/features/projects/lib/project-href"
import { formatHours } from "@/features/projects/lib/format-hours"
import { hasPastTaskAccess } from "@/features/employees/server/task-access.service"
import { createNotification } from "@/lib/notifications"
import {
  canDeleteTask,
  resolveTaskManagerId,
  taskEditLockReason,
} from "@/features/projects/lib/task-permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// "Manager" = the team's manager for project work, or the assignee's line manager for adhoc work.
async function getTaskAuthContext(taskId: string, userId: string) {
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    include: {
      team: {
        select: {
          id: true,
          managerId: true,
          projectId: true,
          project: { select: { slug: true } },
        },
      },
      project: { select: { slug: true } },
      assignee: { select: { id: true, managerId: true } },
    },
  })
  if (!task) return null
  const managerId = resolveTaskManagerId({
    teamId: task.teamId,
    teamManagerId: task.team?.managerId,
    assigneeManagerId: task.assignee?.managerId,
  })
  return {
    task,
    managerId,
    isAssignee: task.assigneeId === userId,
    isManager: !!managerId && managerId === userId,
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
        tags,
        links,
        isMilestone,
        goalId,
        producesOutput,
        outputSkipped,
        holdReason,
        holdExpectedDate,
        discardReason,
      } = body

      const auth = await getTaskAuthContext(ctx.params.id, session.user.id)
      if (!auth) return NextResponse.json({ error: "Task not found" }, { status: 404 })

      const isAdmin = hasPermission(session, PERMISSIONS.PROJECT_WRITE)

      if (!auth.isAssignee && !auth.isManager && !isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      // Detail edits are time-boxed for the author and open to the manager (see task-permissions.ts).
      const subject = {
        creatorId: auth.task.creatorId,
        createdAt: auth.task.createdAt,
        // No project = adhoc; its author/assignee keeps editing rights indefinitely.
        projectId: auth.task.projectId,
        assigneeId: auth.task.assigneeId,
        teamManagerId: auth.managerId,
      }
      const actor = { userId: session.user.id, isAdmin, canEditPastTasks: false }

      // Reassigning is an allocation decision, so it stays with the manager even inside the author's window.
      if (assigneeId !== undefined && !auth.isManager && !isAdmin) {
        return NextResponse.json(
          { error: "Only the team manager can reassign a task." },
          { status: 403 },
        )
      }

      const isStructuralChange =
        title !== undefined ||
        description !== undefined ||
        priority !== undefined ||
        startDate !== undefined ||
        dueDate !== undefined ||
        estimatedHours !== undefined ||
        tags !== undefined
      if (isStructuralChange) {
        actor.canEditPastTasks = await hasPastTaskAccess(session.user.id)
        const refusal = taskEditLockReason(subject, actor)
        if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
      }

      // Moving a hold follow-up whose original was picked up again would double-book the work, so refuse
      // once with what the client needs to ask "keep or remove?" (it re-sends with keepFollowUp).
      if (
        status !== undefined &&
        status !== auth.task.status &&
        auth.task.resumedFromId &&
        body.keepFollowUp !== true
      ) {
        const original = await db.projectTask.findUnique({
          where: { id: auth.task.resumedFromId },
          select: { title: true, status: true },
        })
        if (original && (original.status === "DONE" || original.status === "IN_PROGRESS")) {
          const state = original.status === "DONE" ? "already completed" : "already in progress"
          return NextResponse.json(
            {
              error: `The original task "${original.title}" is ${state}.`,
              details: {
                reason: "FOLLOW_UP_REDUNDANT",
                taskId: ctx.params.id,
                taskTitle: auth.task.title,
                originalTitle: original.title,
                originalStatus: original.status,
              },
            },
            { status: 409 },
          )
        }
      }

      const data: Record<string, unknown> = {}
      let clockAction: "start" | "stop" | null = null
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (status !== undefined) {
        data.status = status
        data.completedAt = status === "DONE" ? new Date() : null

        // Reopening clears "nothing came out of this" - the question is live again.
        if (auth.task.status === "DONE" && status !== "DONE") data.outputSkippedAt = null

        // Time spent is measured: the clock runs while a task is In Progress, and any number of a person's
        // tasks may run at once (settleRunningTasks banks them - see task-clock.service.ts).
        if (status !== auth.task.status) {
          if (status === "IN_PROGRESS") clockAction = "start"
          else if (auth.task.inProgressSince) clockAction = "stop"
        }

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
          data.holdReason = null
          data.holdExpectedDate = null
          data.discardReason = null
        }
      }
      if (priority !== undefined) data.priority = priority
      if (assigneeId !== undefined) {
        // The tenant guard scopes WHERE clauses, not payloads, so check the new assignee is an active
        // employee of THIS tenant before writing the FK.
        if (assigneeId) {
          const assignee = await db.employee.findFirst({
            where: { id: assigneeId, isActive: true },
            select: { id: true },
          })
          if (!assignee) {
            return NextResponse.json(
              { error: "The new assignee is not an active employee here." },
              { status: 422 },
            )
          }
        }
        data.assigneeId = assigneeId ?? null
      }
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null
      if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
      // A finite, non-negative number or null only - NaN would make Prisma reject the whole PATCH.
      if (estimatedHours !== undefined) {
        if (estimatedHours === null || estimatedHours === "") {
          data.estimatedHours = null
        } else {
          const n = Number(estimatedHours)
          if (!Number.isFinite(n) || n < 0) {
            return NextResponse.json({ error: "estimatedHours must be a number" }, { status: 422 })
          }
          data.estimatedHours = n
        }
      }
      // loggedHours is server-measured and never client-writable; ignored (not 422'd) for older clients.
      if (tags !== undefined) data.tags = tags
      if (links !== undefined) {
        // Only http(s) links that parse (they render as clickable anchors), deduped server-side too.
        const cleaned = dedupeLinks((Array.isArray(links) ? links : []).map((l) => String(l)))
        const bad = cleaned.filter((l) => !isSafeHttpUrl(l))
        if (bad.length > 0) {
          return NextResponse.json({ error: `Not a valid web link: ${bad[0]}` }, { status: 422 })
        }
        data.links = cleaned.slice(0, 20)
      }
      if (typeof isMilestone === "boolean") data.isMilestone = isMilestone
      if (typeof producesOutput === "boolean") data.producesOutput = producesOutput
      // "Nothing came out of this" stops the nudge, the Progress label and the digest asking again.
      if (outputSkipped === true) data.outputSkippedAt = new Date()
      // Must be a goal on THIS task's project (another client's goal is a 404). Null unlinks.
      if (goalId !== undefined) {
        if (goalId === null || goalId === "") {
          data.goalId = null
        } else {
          const goalProjectId = auth.task.team?.projectId ?? auth.task.projectId
          const goal = goalProjectId
            ? await db.projectGoal.findFirst({
                where: { id: String(goalId), projectId: goalProjectId },
                select: { id: true },
              })
            : null
          if (!goal) {
            return NextResponse.json({ error: "Goal not found on this project" }, { status: 404 })
          }
          data.goalId = goal.id
        }
      }

      const prevStatus = auth.task.status
      const statusChanged = status !== undefined && status !== prevStatus

      // The task row and its status history move together, or every duration is wrong from then on.
      const { task, resumeTask, removedResume } = await db.$transaction(async (tx) => {
        // Settle every running clock BEFORE the status moves, so starting or stopping below is a clean cut.
        const now = new Date()
        if (clockAction !== null) {
          await settleRunningTasks(tx, {
            assigneeId: auth.task.assigneeId,
            actorId: session.user.id,
            at: now,
          })
        }

        if (clockAction === "start") data.inProgressSince = now
        else if (clockAction === "stop") data.inProgressSince = null

        const updated = await tx.projectTask.update({
          where: { id: ctx.params.id },
          data,
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
          },
        })

        if (statusChanged) {
          await recordStatusChange(tx, {
            taskId: updated.id,
            from: prevStatus,
            to: updated.status,
            actorId: session.user.id,
            taskCreatedAt: auth.task.createdAt,
            // Kept on the period: holdReason is cleared on resume, and history would lose why it was parked.
            note: updated.holdReason ?? updated.discardReason ?? null,
          })
        }
        // Hold books the unfinished hours onto a follow-up task inside the transaction, so they can't be lost.
        // Returned rather than assigned outside, because TS can't see the callback ran.
        let resume: ResumeTaskResult | null = null
        let removedResume: { id: string; dueDate: Date | null } | null = null
        if (statusChanged && updated.status === "ON_HOLD") {
          resume = await upsertResumeTask(tx, updated, session.user.id)
        } else if (statusChanged && prevStatus === "ON_HOLD") {
          // Coming off hold: an untouched follow-up is taken back so it can't double-book the work.
          removedResume = await removeResumeTaskIfPristine(tx, updated.id)
        }
        return { task: updated, resumeTask: resume, removedResume }
      })

      // Before AND after, so the log can answer "who moved the deadline, and from what".
      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectTask",
        entityId: ctx.params.id,
        changes: { fields: diffTaskFields(auth.task, data) ?? {}, applied: data } as object,
      })

      const projectId = auth.task.team?.projectId ?? auth.task.projectId
      const projectSlug = auth.task.team?.project?.slug ?? auth.task.project?.slug ?? null
      if (status !== undefined && status !== prevStatus) {
        if (projectId) {
          await logActivity({
            projectId,
            actorId: session.user.id,
            type: "TASK_STATUS_CHANGED",
            entityType: "TASK",
            entityId: task.id,
            meta: { taskTitle: task.title, from: prevStatus, to: status },
          })
        }

        const mgrId = auth.managerId
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
              link: projectId
                ? projectHref({ id: projectId, slug: projectSlug }, "tasks")
                : "/projects/my-tasks",
            })
          }
        }

        // The follow-up sits on a future date, so tell the assignee where their unfinished hours went.
        if (resumeTask && task.assigneeId) {
          const resumeOn = resumeTask.dueDate.toISOString().slice(0, 10)
          const carried = resumeTask.estimatedHours
          await createNotification({
            employeeId: task.assigneeId,
            title: resumeTask.created ? "Follow-up task created" : "Follow-up task rescheduled",
            message: carried
              ? `"${task.title}" is on hold. ${formatHours(carried)} left to do, booked for ${resumeOn}.`
              : `"${task.title}" is on hold. Picked up again on ${resumeOn} - no hours left on the estimate, so re-estimate it then.`,
            type: "info",
            link: "/projects/my-tasks",
          })
        }

        if (removedResume && task.assigneeId) {
          const wasFor = removedResume.dueDate?.toISOString().slice(0, 10)
          await createNotification({
            employeeId: task.assigneeId,
            title: "Follow-up task removed",
            message: `"${task.title}" came off hold, so the follow-up${wasFor ? ` booked for ${wasFor}` : ""} was removed.`,
            type: "info",
            link: "/projects/my-tasks",
          })
        }
      } else if (typeof isMilestone === "boolean" && projectId) {
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

      // Deleting destroys hours, comments and history, so it stays with the manager - not the author.
      const isAdminDel = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const deletable = canDeleteTask(
        {
          creatorId: auth.task.creatorId,
          createdAt: auth.task.createdAt,
          projectId: auth.task.projectId,
          assigneeId: auth.task.assigneeId,
          teamManagerId: auth.managerId,
        },
        { userId: session.user.id, isAdmin: isAdminDel },
      )
      // Except an untouched hold follow-up: the app raised it, so its assignee may decline it.
      const ownUntouchedFollowUp =
        !deletable && (await canRemoveUntouchedFollowUp(ctx.params.id, session.user.id))

      if (!deletable && !ownUntouchedFollowUp) {
        return NextResponse.json(
          { error: "Only the team manager can delete a task." },
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
