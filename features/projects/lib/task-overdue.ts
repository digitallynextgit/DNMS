// One meaning of "overdue" for tasks everywhere: still open, past its due day, and not on hold -
// held work was parked on purpose, with a date it resumes. SQL and Prisma filters spell the same
// rule out with these statuses.

export const TASK_NOT_OVERDUE_STATUSES = ["DONE", "DISCARDED", "CANCELLED", "ON_HOLD"] as const

const NOT_OVERDUE: ReadonlySet<string> = new Set(TASK_NOT_OVERDUE_STATUSES)

/** `today` and `dueDate` as UTC midnights: a task due today has all of today. */
export function isTaskOverdue(status: string, dueDate: Date | null, today: Date): boolean {
  return dueDate !== null && dueDate < today && !NOT_OVERDUE.has(status)
}
