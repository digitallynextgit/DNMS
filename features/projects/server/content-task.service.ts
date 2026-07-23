import "server-only"

import { db } from "@/server/db"
import { createNotification } from "@/lib/notifications"
import type { TaskStatus } from "@prisma/client"

// =============================================================================
// Keeps a content-calendar entry and its ProjectTask in step.
//
// A planned post is only real work once somebody owns it and it appears on their
// board. Setting an assignee on an entry creates a mirrored task (due on the
// publish date); clearing the assignee removes it. Status moves either way, so
// the writer can tick the task off and the calendar shows POSTED - or mark it
// POSTED in the calendar and the task closes.
// =============================================================================

/** Calendar status -> task status. READY means written but not yet published,
 *  which is still work in progress as far as the board is concerned. */
const TASK_STATUS: Record<string, TaskStatus> = {
  PLANNED: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  READY: "IN_PROGRESS",
  POSTED: "DONE",
}

/** Task status -> calendar status, for the reverse direction. Only DONE carries
 *  a definite meaning; the rest map back to the obvious counterpart. */
const ENTRY_STATUS: Partial<Record<TaskStatus, string>> = {
  TODO: "PLANNED",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "POSTED",
}

export interface CalendarEntryLike {
  id: string
  projectId: string
  date: Date | null
  platform: string | null
  theme: string | null
  format: string | null
  hook: string | null
  status: string
  assigneeId: string | null
  taskId: string | null
}

/** A readable task title from whatever the entry actually has filled in. */
export function contentTaskTitle(e: {
  platform: string | null
  format: string | null
  theme: string | null
}): string {
  const what = [e.platform, e.format].filter(Boolean).join(" ")
  const topic = e.theme?.trim()
  if (what && topic) return `${what}: ${topic}`
  if (topic) return `Content: ${topic}`
  if (what) return `${what} post`
  return "Content post"
}

/** The assignee's team on this project, so the task lands on the right board.
 *  Null is acceptable - ProjectTask.teamId is nullable. */
async function findTeamId(projectId: string, employeeId: string): Promise<string | null> {
  const member = await db.projectTeamMember.findFirst({
    where: { employeeId, team: { projectId } },
    select: { teamId: true },
  })
  return member?.teamId ?? null
}

/**
 * Reconcile the task for one entry. Called after any create/update.
 * Returns the entry's taskId afterwards (null when there shouldn't be a task).
 */
export async function syncEntryTask(
  entry: CalendarEntryLike,
  actorId: string,
): Promise<string | null> {
  // No owner -> no task. If one existed, the work is no longer assigned, so drop
  // it rather than leaving an orphan on someone's board.
  if (!entry.assigneeId) {
    if (entry.taskId) {
      await db.projectTask.delete({ where: { id: entry.taskId } }).catch(() => {})
      await db.contentCalendarEntry.update({
        where: { id: entry.id },
        data: { taskId: null },
      })
    }
    return null
  }

  const status = TASK_STATUS[entry.status] ?? "TODO"
  const title = contentTaskTitle(entry)
  const description = entry.hook?.trim()
    ? `Hook: ${entry.hook.trim()}`
    : "Created from the content calendar."

  if (entry.taskId) {
    const existing = await db.projectTask.findUnique({
      where: { id: entry.taskId },
      select: { id: true, status: true, assigneeId: true },
    })
    if (existing) {
      await db.projectTask.update({
        where: { id: existing.id },
        data: {
          title,
          description,
          dueDate: entry.date,
          status,
          completedAt: status === "DONE" ? new Date() : null,
          ...(existing.assigneeId === entry.assigneeId
            ? {}
            : {
                assigneeId: entry.assigneeId,
                teamId: await findTeamId(entry.projectId, entry.assigneeId),
              }),
        },
      })
      // Only ping on a genuine hand-over, not on every edit.
      if (existing.assigneeId !== entry.assigneeId) {
        await notifyAssigned(entry, title)
      }
      return existing.id
    }
    // The task was deleted from the board - fall through and make a new one.
  }

  const task = await db.projectTask.create({
    data: {
      projectId: entry.projectId,
      teamId: await findTeamId(entry.projectId, entry.assigneeId),
      title,
      description,
      status,
      priority: "MEDIUM",
      assigneeId: entry.assigneeId,
      creatorId: actorId,
      dueDate: entry.date,
      completedAt: status === "DONE" ? new Date() : null,
      isManagerCreated: true,
      tags: ["content"],
    },
    select: { id: true },
  })

  await db.contentCalendarEntry.update({
    where: { id: entry.id },
    data: { taskId: task.id },
  })
  await notifyAssigned(entry, title)
  return task.id
}

async function notifyAssigned(entry: CalendarEntryLike, title: string) {
  if (!entry.assigneeId) return
  const when = entry.date ? ` · publish ${entry.date.toISOString().slice(0, 10)}` : ""
  await createNotification({
    employeeId: entry.assigneeId,
    title: "New content assigned",
    message: `${title}${when}`,
    type: "info",
    link: `/projects/${entry.projectId}?tab=brand`,
  })
}

/** Remove the mirrored task when an entry is deleted. */
export async function removeEntryTask(taskId: string | null): Promise<void> {
  if (!taskId) return
  await db.projectTask.delete({ where: { id: taskId } }).catch(() => {})
}

/**
 * Reverse direction: a task closed (or reopened) on the board updates the
 * calendar entry it came from. Safe to call for ANY task - it no-ops unless the
 * task is linked to an entry.
 */
export async function syncTaskToEntry(taskId: string, status: TaskStatus): Promise<void> {
  const entry = await db.contentCalendarEntry.findUnique({
    where: { taskId },
    select: { id: true, status: true },
  })
  if (!entry) return

  const next = ENTRY_STATUS[status]
  // ON_HOLD / DISCARDED have no calendar counterpart - leave the plan alone
  // rather than inventing a state for it.
  if (!next || next === entry.status) return

  await db.contentCalendarEntry.update({ where: { id: entry.id }, data: { status: next } })
}
