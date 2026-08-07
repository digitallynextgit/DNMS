import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { createAuditLog } from "@/lib/audit"
import { logActivity } from "@/features/projects/server/activity"
import { syncTaskToEntry } from "@/features/projects/server/content-task.service"
import { recordStatusChange } from "@/features/projects/server/task-status-periods"
import { diffTaskFields } from "@/features/projects/server/task-audit"
import { dedupeLinks, isSafeHttpUrl } from "@/features/projects/lib/task-links"
import { createNotification } from "@/lib/notifications"
import {
  canDeleteTask,
  resolveTaskManagerId,
  taskEditLockReason,
} from "@/features/projects/lib/task-permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Permission helper: returns roles for the current user against a task.
//
// "Manager" is the team's manager for project work and the assignee's LINE
// manager for adhoc work, which has no team - see resolveTaskManagerId.
async function getTaskAuthContext(taskId: string, userId: string) {
  const task = await db.projectTask.findUnique({
    where: { id: taskId },
    include: {
      team: { select: { id: true, managerId: true, projectId: true } },
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
        loggedHours,
        tags,
        links,
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

      // Editing the task's DETAILS is time-boxed for whoever raised it and open
      // to the manager; moving it through the workflow (status) is not covered -
      // see task-permissions.ts for why.
      const subject = {
        creatorId: auth.task.creatorId,
        createdAt: auth.task.createdAt,
        teamManagerId: auth.managerId,
      }
      const actor = { userId: session.user.id, isAdmin }

      // Handing the work to someone ELSE is an allocation decision, not a
      // correction, so it stays with the manager even inside the author's
      // window - this route does not verify the new assignee is on the team.
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
        const refusal = taskEditLockReason(subject, actor)
        if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
      }

      const data: Record<string, unknown> = {}
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (status !== undefined) {
        data.status = status
        data.completedAt = status === "DONE" ? new Date() : null

        // Time spent is MEASURED, not typed in: the clock starts the moment a
        // task enters In Progress and the elapsed stretch is banked into
        // loggedHours when it leaves. A task can be started and paused any
        // number of times; each stretch adds to the total.
        if (status !== auth.task.status) {
          if (status === "IN_PROGRESS") {
            data.inProgressSince = new Date()
          } else if (auth.task.inProgressSince) {
            const elapsedHours = (Date.now() - auth.task.inProgressSince.getTime()) / 3_600_000
            // Round to the second so repeated start/stop cycles cannot drift.
            data.loggedHours =
              Math.round((auth.task.loggedHours + Math.max(0, elapsedHours)) * 3600) / 3600
            data.inProgressSince = null
          }
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
      if (links !== undefined) {
        // Only http(s), and only what parses. A cell where anyone can type is a
        // cell where "javascript:..." can be typed, and these render as
        // clickable anchors for the whole team.
        // Deduped server-side too: the client already does it, but a repeated
        // URL is stored data that then renders as two identical chips sharing a
        // React key, and the API cannot assume the client bothered.
        const cleaned = dedupeLinks((Array.isArray(links) ? links : []).map((l) => String(l)))
        const bad = cleaned.filter((l) => !isSafeHttpUrl(l))
        if (bad.length > 0) {
          return NextResponse.json({ error: `Not a valid web link: ${bad[0]}` }, { status: 422 })
        }
        // 20 is far past "the brief, the doc, the live page" and stops a paste
        // of someone's whole clipboard becoming a row nobody can read.
        data.links = cleaned.slice(0, 20)
      }
      if (typeof isMilestone === "boolean") data.isMilestone = isMilestone

      const prevStatus = auth.task.status
      const statusChanged = status !== undefined && status !== prevStatus

      // The task row and its status history move together: a recorded status
      // with no period (or the reverse) would make every duration wrong from
      // that point on.
      const task = await db.$transaction(async (tx) => {
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
          })
        }
        return updated
      })

      // Before AND after, not just the new value: "who moved the deadline, and
      // from what" is the question the activity log gets asked, and recording
      // only the result made it unanswerable the moment it was written.
      await createAuditLog(session, {
        action: "UPDATE",
        module: "project",
        entityType: "ProjectTask",
        entityId: ctx.params.id,
        changes: { fields: diffTaskFields(auth.task, data) ?? {}, applied: data } as object,
      })

      // Null for adhoc work, which belongs to no project - there is no activity
      // feed to write to and no project page to link a notification at.
      const projectId = auth.task.team?.projectId ?? auth.task.projectId
      if (status !== undefined && status !== prevStatus) {
        // If this task mirrors a content-calendar post, move the plan with it -
        // ticking the task off is how a writer marks the post published.
        await syncTaskToEntry(task.id, task.status)

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

        // Notify whoever manages this task on the key transitions - the team
        // manager, or the assignee's line manager when it is adhoc.
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
              // Adhoc work has no project page; My Tasks is where it lives.
              link: projectId ? `/projects/${projectId}` : "/projects/my-tasks",
            })
          }
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

      // Deleting destroys the task's hours, comments and history, so it stays
      // with the manager - the person who raised it cannot take it back, not
      // even inside their edit window.
      const isAdminDel = hasPermission(session, PERMISSIONS.PROJECT_WRITE)
      const deletable = canDeleteTask(
        {
          creatorId: auth.task.creatorId,
          createdAt: auth.task.createdAt,
          teamManagerId: auth.managerId,
        },
        { userId: session.user.id, isAdmin: isAdminDel },
      )
      if (!deletable) {
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
