import "server-only"

import type { Prisma, ProjectTask } from "@prisma/client"
import { db, type DbTransaction } from "@/server/db"
import { openFirstStatusPeriod } from "./task-status-periods"

// Holding a task raises a follow-up dated for the resume day, carrying the hours never spent.

/** Statuses that mean a follow-up is still live and should be reused, not duplicated. */
const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW", "ON_HOLD"] as const

/** Hours booked but never spent. Null when there is nothing meaningful to carry. */
export function remainingHours(estimatedHours: number | null, loggedHours: number): number | null {
  if (estimatedHours == null) return null
  // Round to the minute to avoid float noise like 2.9999999999999996h.
  const left = Math.round((estimatedHours - loggedHours) * 60) / 60
  // Over the estimate: leave it unestimated so whoever picks it up re-books it.
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
 * Raise or refresh the follow-up for a task just put ON_HOLD, inside the caller's transaction.
 * Null when the task has no resume date.
 */
export async function upsertResumeTask(
  tx: DbTransaction,
  task: ProjectTask,
  actorId: string,
): Promise<ResumeTaskResult | null> {
  if (!task.holdExpectedDate) return null

  const carried = remainingHours(task.estimatedHours, task.loggedHours)

  // Held -> resumed -> held again reuses the open follow-up instead of adding a second.
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
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      teamId: task.teamId,
      seoPropertyId: task.seoPropertyId,
      tags: task.tags,
      links: task.links,
      creatorId: actorId,
      isManagerCreated: task.isManagerCreated,
      status: "TODO",
      resumedFromId: task.id,
    },
    select: { id: true, title: true, dueDate: true, estimatedHours: true },
  })

  // Like every other create path, so the task shows in the activity log.
  await openFirstStatusPeriod(tx, { taskId: created.id, status: "TODO", actorId })

  return { ...created, dueDate: created.dueDate ?? task.holdExpectedDate, created: true }
}

/**
 * Take back the follow-up when a task comes off hold, so the work isn't double-booked. Only an
 * untouched follow-up is deleted; once someone has engaged with it, it stays.
 */
export async function removeResumeTaskIfPristine(
  tx: DbTransaction,
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

/** Untouched: never started, no hours, nothing written. One definition for both remove paths. */
const PRISTINE_FOLLOW_UP = {
  status: "TODO",
  loggedHours: 0,
  inProgressSince: null,
  comments: { none: {} },
  checklistItems: { none: {} },
  timesheets: { none: {} },
} satisfies Omit<Prisma.ProjectTaskWhereInput, "resumedFromId">

/** Deleting is manager-only, but an assignee may decline an untouched, auto-raised follow-up. */
export async function canRemoveUntouchedFollowUp(taskId: string, userId: string): Promise<boolean> {
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
