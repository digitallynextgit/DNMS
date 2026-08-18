import { TASK_EDIT_WINDOW_MS, editWindowRemaining, formatWindowLeft } from "@/lib/edit-window"

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
  /**
   * Null = adhoc. REQUIRED, not optional, and deliberately so: the own-adhoc
   * exemption below keys off "no project", so an omitted field would silently
   * read every project task as adhoc and hand the exemption to everyone. Making
   * it required means a forgotten call site is a compile error, not a hole.
   */
  projectId: string | null
  assigneeId: string | null
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
export const ADHOC_LABEL = "ADHOC"
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
  /**
   * HR has lifted the 15-minute window for this person (Employee
   * .canEditPastTasks), so they may go back and correct their OWN tasks - fill
   * in a day they missed, fix last week's sheet.
   *
   * Deliberately narrow: it does NOT let them edit work they did not raise, and
   * it does NOT let them delete anything. It buys back the ability to correct
   * their own record, not authority over somebody else's.
   */
  canEditPastTasks?: boolean
}

function isManagerOrAdmin(task: TaskEditSubject, actor: TaskActor): boolean {
  return actor.isAdmin || (!!task.teamManagerId && task.teamManagerId === actor.userId)
}

/**
 * Your own adhoc work: no project, you raised it, and it is assigned to you.
 *
 * The 15-minute window exists because a task is a commitment other people plan
 * around - which is simply not true of a client-less task you booked for
 * yourself. Nobody is scheduled against your internal QC slot, so needing your
 * line manager to fix its wording an hour later is friction that buys nothing.
 * All three conditions are required: hand it to someone else, or raise it on a
 * project, and it becomes a commitment again and the window applies.
 */
function isOwnAdhocTask(task: TaskEditSubject, actor: TaskActor): boolean {
  return (
    task.projectId === null &&
    task.creatorId === actor.userId &&
    task.assigneeId !== null &&
    task.assigneeId === actor.userId
  )
}

/** May this person change the task's details (not its status) right now? */
export function canEditTaskDetails(
  task: TaskEditSubject,
  actor: TaskActor,
  now = Date.now(),
): boolean {
  if (isManagerOrAdmin(task, actor)) return true
  if (isOwnAdhocTask(task, actor)) return true
  if (task.creatorId !== actor.userId) return false
  // The window, unless HR has lifted it for this person.
  if (actor.canEditPastTasks) return true
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
  // Adhoc work has no team, so "the team manager" names nobody and sends the
  // reader looking for a person who does not exist. Their line manager is who
  // actually holds the task - see resolveTaskManagerId.
  const authority = task.projectId ? "the team manager" : "your manager"
  if (task.creatorId === actor.userId) {
    return `The 15-minute window to edit this task has closed. Ask ${authority} to change it.`
  }
  return `Only ${authority} can edit a task you did not raise.`
}

/** "12m left" while the author can still edit, empty once it has closed. */
export function taskEditWindowLeft(task: TaskEditSubject, now = Date.now()): string {
  return formatWindowLeft(editWindowRemaining(task.createdAt, now, TASK_EDIT_WINDOW_MS))
}
