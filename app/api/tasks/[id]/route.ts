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
        // loggedHours is deliberately NOT destructured - see API-04 below.
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
        // Straight off the stored row - a task with no project is adhoc, and its
        // own author/assignee keeps editing rights indefinitely.
        projectId: auth.task.projectId,
        assigneeId: auth.task.assigneeId,
        teamManagerId: auth.managerId,
      }
      const actor = { userId: session.user.id, isAdmin, canEditPastTasks: false }

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
        // Looked up only here, where it can change the answer - a details edit
        // by someone whose window may have closed. The far commoner status-only
        // update never pays for it.
        actor.canEditPastTasks = await hasPastTaskAccess(session.user.id)
        const refusal = taskEditLockReason(subject, actor)
        if (refusal) return NextResponse.json({ error: refusal }, { status: 403 })
      }

      // Moving a HOLD FOLLOW-UP whose original has since been picked up again.
      // The follow-up exists to carry work forward; if the original is already
      // in progress or finished, that work is happening (or happened) there, and
      // touching this one silently double-books it. Refuse once with everything
      // the client needs to ask "keep it, or remove it?" - answering re-sends
      // with keepFollowUp, so a UI that does not handle the question gets a
      // plain error instead of quietly doing the wrong thing.
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
      /** Whether THIS task's clock starts, stops, or is untouched by this PATCH. */
      let clockAction: "start" | "stop" | null = null
      if (title !== undefined) data.title = title
      if (description !== undefined) data.description = description
      if (status !== undefined) {
        data.status = status
        data.completedAt = status === "DONE" ? new Date() : null

        // Time spent is MEASURED, not typed in: the clock starts the moment a
        // task enters In Progress and the elapsed stretch is banked into
        // loggedHours when it leaves. A task can be started and stopped any
        // number of times; each stretch adds to the total.
        //
        // ANY NUMBER OF A PERSON'S TASKS MAY RUN AT ONCE. The banking itself is
        // done by settleRunningTasks inside the transaction below, which pays
        // every running clock its share of the stretch just ended - see
        // task-clock.service.ts. All this branch decides is whether THIS task's
        // clock is running afterwards.
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
      // Validate numbers instead of writing raw parseFloat results (API-04): an
      // empty string / non-numeric became NaN, which Prisma rejects -> the whole
      // PATCH (including a legitimate status change) 500s. A finite, non-negative
      // number or explicit null only.
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
      // loggedHours is NOT client-writable (API-04). It is measured by the
      // server from inProgressSince above (:179), and it feeds the performance
      // page, progress buckets and over-budget reminders - so accepting it from
      // the request body let anyone set their own "time spent" to whatever they
      // liked, and worse, silently overwrote the value just measured on this
      // very request. No client sends it; every UI reads it. Ignored, not 422'd,
      // so an older client that still posts the field keeps working.
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
      const { task, resumeTask, removedResume, sharedTasks } = await db.$transaction(async (tx) => {
        // ── Settle BEFORE the status moves ──────────────────────────────────
        // Every running clock is paid its share of the stretch that is ending,
        // at the rate that applied while it ran. Doing it first is what makes
        // the arithmetic exact: after this line every running task (including
        // this one, if it was running) is banked and restarted from `now`, so
        // starting or stopping below is a clean cut. See task-clock.service.ts.
        const now = new Date()
        const sharedTasks =
          clockAction === null
            ? []
            : await settleRunningTasks(tx, {
                assigneeId: auth.task.assigneeId,
                actorId: session.user.id,
                at: now,
              })

        // Now this task's own clock. Several of a person's tasks may run at
        // once; starting one does NOT stop the others.
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
            // Kept ON the period: the task's own holdReason is cleared the moment
            // the work resumes, so the history would otherwise lose why it was
            // ever parked.
            note: updated.holdReason ?? updated.discardReason ?? null,
          })
        }
        // Hold books the unfinished hours onto a task dated for the day the work
        // is expected to resume. Inside the transaction on purpose: a hold
        // recorded WITHOUT the task carrying its hours is the exact silent loss
        // this prevents. `updated` is used rather than auth.task so the carried
        // hours include the stretch just banked by this very request.
        // Returned alongside the task rather than assigned to an outer variable:
        // TypeScript cannot see that a callback ran, so a `let` written only in
        // here still reads as null afterwards.
        let resume: ResumeTaskResult | null = null
        let removedResume: { id: string; dueDate: Date | null } | null = null
        if (statusChanged && updated.status === "ON_HOLD") {
          resume = await upsertResumeTask(tx, updated, session.user.id)
        } else if (statusChanged && prevStatus === "ON_HOLD") {
          // Coming OFF hold - resumed, finished the same day, or abandoned. The
          // follow-up meant "the rest of this, later"; that later is now, so an
          // untouched one is taken back rather than left to double-book the work
          // into a future week.
          removedResume = await removeResumeTaskIfPristine(tx, updated.id)
        }
        return { task: updated, resumeTask: resume, removedResume, sharedTasks }
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

        // Tell the assignee where their unfinished hours went. The follow-up sits
        // on a FUTURE date, so it is not on the board they are looking at when
        // they hit hold - without this the hours look like they vanished.
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

        // The mirror of the above: the hours came back to this task, so say so
        // rather than letting a planned day quietly empty itself.
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

      // Returned so the client can say the stretch was SHARED. Time landing on
      // a task at half rate, with nothing on screen explaining why, is the kind
      // of thing people only notice at the end of the month.
      return NextResponse.json({
        data: task,
        ...(sharedTasks.length > 0 ? { sharedTasks } : {}),
      })
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
          projectId: auth.task.projectId,
          assigneeId: auth.task.assigneeId,
          teamManagerId: auth.managerId,
        },
        { userId: session.user.id, isAdmin: isAdminDel },
      )
      // ...with one exception: an UNTOUCHED hold follow-up. The app raised that
      // one automatically, and there is nothing in it to destroy, so its
      // assignee may decline it without chasing a manager - which is what the
      // "Remove task" answer in the follow-up dialog does.
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
