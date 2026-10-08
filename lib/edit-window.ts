/**
 * Chat messages stay editable/deletable for 15 minutes, then stand as a record. Enforced on the
 * server, and not an admin-overridable permission.
 */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

/** Same for a task's author; after that only the team manager or a project admin can change it. */
export const TASK_EDIT_WINDOW_MS = 15 * 60 * 1000

/** Milliseconds left in the window, 0 once it has closed. */
export function editWindowRemaining(
  createdAt: string | Date,
  now = Date.now(),
  windowMs = MESSAGE_EDIT_WINDOW_MS,
): number {
  const posted = new Date(createdAt).getTime()
  if (Number.isNaN(posted)) return 0
  return Math.max(0, posted + windowMs - now)
}

export function isWithinEditWindow(
  createdAt: string | Date,
  now = Date.now(),
  windowMs = MESSAGE_EDIT_WINDOW_MS,
): boolean {
  return editWindowRemaining(createdAt, now, windowMs) > 0
}

/** "14m left" / "40s left". */
export function formatWindowLeft(ms: number): string {
  if (ms <= 0) return ""
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s left`
  return `${Math.ceil(totalSeconds / 60)}m left`
}
