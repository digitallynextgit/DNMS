/**
 * How long after posting a chat message stays editable and deletable.
 *
 * Project chat is a record of what was decided and when. A message that can be
 * silently rewritten a week later is not a record, so the author gets a short
 * window to fix a typo or pull something sent by mistake, and after that the
 * line stands. Enforced on the server; the UI only hides the buttons.
 *
 * Deliberately NOT a permission an admin can override - see the API routes.
 */
export const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000

/**
 * How long the person who raised a task may still correct it.
 *
 * Same reasoning, same length: a task is a commitment someone else is planning
 * around, so the author gets long enough to fix a typo or a wrong estimate and
 * after that the wording stands. Only the team manager (or a project admin) can
 * change it beyond that, and nobody but them can delete it at all.
 */
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

/** "14m left" / "40s left" - shown on the edit control so the clock is visible. */
export function formatWindowLeft(ms: number): string {
  if (ms <= 0) return ""
  const totalSeconds = Math.ceil(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s left`
  return `${Math.ceil(totalSeconds / 60)}m left`
}
