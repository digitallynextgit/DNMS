import "server-only"

import type { Prisma, ProjectTask } from "@prisma/client"
import { db } from "@/server/db"
import { openFirstStatusPeriod } from "./task-status-periods"

// =============================================================================
// Putting work on hold without losing it.
//
// "On hold" used to be a dead end: the task stopped, its unfinished hours stayed
// booked against a day that had already passed, and the only record of when it
// should restart was a date field nobody's board showed. So the work quietly
// vanished from the week it was actually going to happen in.
//
// Holding a task now raises a follow-up dated for the day it is expected to
// resume, carrying the hours that were never spent. The held task keeps its own
// history (and the hours it DID consume); the follow-up is what shows up in My
// Tasks on the resume date.
// =============================================================================

/** Statuses that mean a follow-up is still live and should be reused, not duplicated. */
const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] as const

/** Hours booked but never spent. Null when there is nothing meaningful to carry. */
export function remainingHours(estimatedHours: number | null, loggedHours: number): number | null {
  if (estimatedHours == null) return null
  // Round to the minute; a float subtraction of measured time otherwise produces
  // things like 2.9999999999999996h on the follow-up.
  const left = Math.round((estimatedHours - loggedHours) * 60) / 60
  // Already over the estimate: carrying 0 or a negative would create a task the
  // reminder engine skips and nobody can plan around. Leave it unestimated so
  // whoever picks it up re-books it honestly.
  return left > 0 ? left : null
}

export interface ResumeTaskResult {
  id: string
  title: string
  dueDate: Date
  estimatedHours: number | null
  /** False when an existing follow-up was updated rather than a new one raised. */
  created: boolean
}

/**
 * Raise (or refresh) the follow-up task for a task that has just gone ON_HOLD.
 *
 * Runs inside the caller's transaction so the hold and its follow-up land
 * together - a hold recorded without the task that carries its hours would be
 * exactly the silent loss this exists to prevent.
 *
 * Returns null when the task has no resume date, which is the only case where a
 * follow-up would have nowhere to sit.
 */
export async function upsertResumeTask(
  tx: Prisma.TransactionClient,
  task: ProjectTask,
  actorId: string,
): Promise<ResumeTaskResult | null> {
  if (!task.holdExpectedDate) return null

  const carried = remainingHours(task.estimatedHours, task.loggedHours)

  // Held -> resumed -> held again must not spawn a second follow-up. Reuse the
  // open one and move it to the new date with the newly-recalculated hours.
  const existing = await tx.projectTask.findFirst({
    where: { resumedFromId: task.id, status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })

  const shared = {
    startDate: task.holdExpectedDate,
    dueDate: task.holdExpectedDate,
    estimatedHours: carried,
    assigneeId: task.assigneeId,
    priority: task.priority,
  }

  if (existing) {
    const updated = await tx.projectTask.update({
      where: { id: existing.id },
      data: shared,
      select: { id: true, title: true, dueDate: true, estimatedHours: true },
    })
    return { ...updated, dueDate: updated.dueDate ?? task.holdExpectedDate, created: false }
  }

  const created = await tx.projectTask.create({
    data: {
      ...shared,
      // Same title: it is the same piece of work, and renaming it would break
      // the thread for anyone scanning the board for it.
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      teamId: task.teamId,
      seoPropertyId: task.seoPropertyId,
      tags: task.tags,
      links: task.links,
      // Whoever put the task on hold raised this one.
      creatorId: actorId,
      isManagerCreated: task.isManagerCreated,
      status: "TODO",
      resumedFromId: task.id,
    },
    select: { id: true, title: true, dueDate: true, estimatedHours: true },
  })

  // Same as every other creation path (see app/api/tasks/route.ts): a task with
  // no open period has no history at all, so its own leg would be invisible in
  // the activity log until somebody happened to move it.
  await openFirstStatusPeriod(tx, { taskId: created.id, status: "TODO", actorId })

  return { ...created, dueDate: created.dueDate ?? task.holdExpectedDate, created: true }
}

/**
 * Take back the follow-up when a task comes OFF hold.
 *
 * The follow-up only ever meant "the rest of this, later". The moment the
 * original is picked up again - resumed, finished the same day, or abandoned -
 * that later has become now, and leaving the follow-up behind would double-book
 * the work into a future week nobody revisits.
 *
 * Deletes ONLY an untouched follow-up: still TODO, no hours on it, never
 * started, nothing written on it. Once somebody has engaged with it, it is
 * their task rather than our bookkeeping, so it stays and the caller is told
 * nothing was removed.
 */
export async function removeResumeTaskIfPristine(
  tx: Prisma.TransactionClient,
  heldTaskId: string,
): Promise<{ id: string; dueDate: Date | null } | null> {
  const pristine = await tx.projectTask.findFirst({
    where: { resumedFromId: heldTaskId, ...PRISTINE_FOLLOW_UP },
    select: { id: true, dueDate: true },
  })
  if (!pristine) return null

  await tx.projectTask.delete({ where: { id: pristine.id } })
  return pristine
}

/**
 * "Nobody has touched this" - never started, no hours, and nothing a human
 * wrote on it. One definition, used both when a hold is lifted automatically
 * and when someone answers "remove it" to the follow-up dialog, so the two can
 * never disagree about what is safe to delete.
 */
const PRISTINE_FOLLOW_UP = {
  status: "TODO",
  loggedHours: 0,
  inProgressSince: null,
  comments: { none: {} },
  checklistItems: { none: {} },
  timesheets: { none: {} },
} satisfies Omit<Prisma.ProjectTaskWhereInput, "resumedFromId">

/**
 * May this person delete this task outright?
 *
 * Deleting is normally the manager's alone, because it destroys hours, comments
 * and history. An untouched hold follow-up has none of those: the app raised it
 * automatically, so its assignee can decline it without needing a manager. The
 * moment it has any real content this returns false and the usual rule applies.
 */
export async function canRemoveUntouchedFollowUp(taskId: string, userId: string): Promise<boolean> {
  // Reads the shared client rather than taking a transaction client: this is a
  // permission check made before any write, so it has nothing to join.
  const match = await db.projectTask.findFirst({
    where: {
      id: taskId,
      assigneeId: userId,
      resumedFromId: { not: null },
      ...PRISTINE_FOLLOW_UP,
    },
    select: { id: true },
  })
  return !!match
}
