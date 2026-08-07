import { TASK_EDIT_WINDOW_MS, editWindowRemaining, formatWindowLeft } from "./edit-window"

// =============================================================================
// Who may change a task, and for how long.
//
// A task is a commitment other people plan around, so it is not freely
// rewritable by whoever raised it:
//
//   • the team MANAGER (and a project admin) may edit or delete it at any time
//   • whoever RAISED it may correct its details for 15 minutes, then no longer
//   • nobody else may edit it, and nobody but a manager/admin may delete it
//
// Status is deliberately NOT covered here. Moving a task through the workflow
// is doing the work, not editing the record - the assignee has to be able to
// start and finish it a week later. Only the task's DETAILS (title, notes,
// dates, estimate, priority, assignee) close after the window.
//
// Shared by the API route and every view, so the buttons a person sees and the
// rules the server enforces cannot drift apart.
// =============================================================================

/** The bits of a task the rules read. Satisfied by the Prisma row and the DTOs. */
export interface TaskEditSubject {
  creatorId: string
  createdAt: string | Date
  /** Whoever plays manager for this task - see resolveTaskManagerId. */
  teamManagerId?: string | null
}

/**
 * Who plays "manager" for a task.
 *
 * A project task answers to the manager of the team it sits in. An ADHOC task -
 * a meeting, an interview, internal QC - belongs to no project and no team, so
 * there is no team manager to answer to; the assignee's LINE manager stands in.
 * Without this an adhoc task would have no authority over it at all: nobody
 * could approve it, edit it after the author's window, or delete it.
 */
export function resolveTaskManagerId(task: {
  teamId: string | null
  teamManagerId?: string | null
  assigneeManagerId?: string | null
}): string | null {
  return task.teamId ? (task.teamManagerId ?? null) : (task.assigneeManagerId ?? null)
}

/** A task with no project is adhoc: work that belongs to no client. */
export function isAdhocTask(task: { projectId?: string | null }): boolean {
  return !task.projectId
}

/** What adhoc work is called wherever a project name would otherwise go. */
export const ADHOC_LABEL = "Adhoc"
export const ADHOC_DESCRIPTION = "Meetings, interviews and other work with no client"

/**
 * The sheet needs a row id for the adhoc bucket, and every other row is keyed
 * by project id. A sentinel keeps that one code path instead of two.
 */
export const ADHOC_ROW_ID = "__adhoc__"

export interface TaskActor {
  userId: string
  /** Project admin / PROJECT_WRITE holder - unrestricted. */
  isAdmin: boolean
}

function isManagerOrAdmin(task: TaskEditSubject, actor: TaskActor): boolean {
  return actor.isAdmin || (!!task.teamManagerId && task.teamManagerId === actor.userId)
}

/** May this person change the task's details (not its status) right now? */
export function canEditTaskDetails(
  task: TaskEditSubject,
  actor: TaskActor,
  now = Date.now(),
): boolean {
  if (isManagerOrAdmin(task, actor)) return true
  if (task.creatorId !== actor.userId) return false
  return editWindowRemaining(task.createdAt, now, TASK_EDIT_WINDOW_MS) > 0
}

/** Deleting a task destroys its history, so it stays with the manager. */
export function canDeleteTask(task: TaskEditSubject, actor: TaskActor): boolean {
  return isManagerOrAdmin(task, actor)
}

/**
 * Why an edit is refused, phrased for the person being refused - or null when
 * it is allowed. The API returns this verbatim, so a 403 explains itself.
 */
export function taskEditLockReason(
  task: TaskEditSubject,
  actor: TaskActor,
  now = Date.now(),
): string | null {
  if (canEditTaskDetails(task, actor, now)) return null
  if (task.creatorId === actor.userId) {
    return "The 15-minute window to edit this task has closed. Ask the team manager to change it."
  }
  return "Only the team manager can edit a task you did not raise."
}

/** "12m left" while the author can still edit, empty once it has closed. */
export function taskEditWindowLeft(task: TaskEditSubject, now = Date.now()): string {
  return formatWindowLeft(editWindowRemaining(task.createdAt, now, TASK_EDIT_WINDOW_MS))
}
