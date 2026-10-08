import { TASK_EDIT_WINDOW_MS, editWindowRemaining, formatWindowLeft } from "@/lib/edit-window"

// Who may change a task's details (not status - moving it along is doing the work):
// the team manager/admin any time, whoever raised it for 15 minutes, nobody else.
// Only a manager/admin may delete.

export interface TaskEditSubject {
  creatorId: string
  createdAt: string | Date
  /** Whoever plays manager for this task - see resolveTaskManagerId. */
  teamManagerId?: string | null
  /** Null = adhoc. Required: an omitted field would read as adhoc and get the exemption. */
  projectId: string | null
  assigneeId: string | null
}

/** The task's "manager": its team's manager, or for adhoc work the assignee's line manager. */
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

export const ADHOC_LABEL = "ADHOC"
export const ADHOC_DESCRIPTION = "Meetings, interviews and other work with no client"

/** Sentinel row id for the adhoc bucket (other rows are keyed by project id). */
export const ADHOC_ROW_ID = "__adhoc__"

export interface TaskActor {
  userId: string
  /** Project admin / PROJECT_WRITE holder - unrestricted. */
  isAdmin: boolean
  /** HR lifted the 15-minute window: may edit their OWN tasks any time (not others', not delete). */
  canEditPastTasks?: boolean
}

function isManagerOrAdmin(task: TaskEditSubject, actor: TaskActor): boolean {
  return actor.isAdmin || (!!task.teamManagerId && task.teamManagerId === actor.userId)
}

/** Own adhoc work (no project, raised by and assigned to you): nobody plans around it, no window. */
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

/** Why an edit is refused, for the person refused (the API returns it verbatim), or null. */
export function taskEditLockReason(
  task: TaskEditSubject,
  actor: TaskActor,
  now = Date.now(),
): string | null {
  if (canEditTaskDetails(task, actor, now)) return null
  // Adhoc work has no team; the line manager holds it.
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
