// Pure checklist rules. canComplete() enforces "no relieving until all clearances are signed".

/** Milliseconds in a day. Dates here are date-only, so no DST arithmetic. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When an item is due: `offsetDays` from the anchor (joining date, or last working day for an
 * exit - negative means before). Null with no anchor or offset: no date beats a made-up one.
 */
export function itemDueDate(
  anchorDate: Date | string | null | undefined,
  offsetDays: number | null | undefined,
): Date | null {
  if (anchorDate == null || offsetDays == null) return null
  const anchor = anchorDate instanceof Date ? anchorDate : new Date(anchorDate)
  if (Number.isNaN(anchor.getTime())) return null
  // UTC calendar parts: these are DATE columns, and a local offset can shift the day.
  const base = Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate())
  return new Date(base + offsetDays * DAY_MS)
}

/** The shape canComplete/progress need. Both instance rows and tests satisfy it. */
export interface ChecklistItemState {
  id: string
  text: string
  itemKind: "TASK" | "CLEARANCE"
  isRequired: boolean
  isDone: boolean
}

export interface CompletionCheck {
  ok: boolean
  /** Required clearances still unsigned. Named, so the refusal can say which. */
  blocking: { id: string; text: string }[]
}

/** Only a required CLEARANCE blocks completion; a required TASK does not. */
export function canComplete(items: readonly ChecklistItemState[]): CompletionCheck {
  const blocking = items
    .filter((i) => i.itemKind === "CLEARANCE" && i.isRequired && !i.isDone)
    .map((i) => ({ id: i.id, text: i.text }))
  return { ok: blocking.length === 0, blocking }
}

export interface ChecklistProgress {
  total: number
  done: number
  /** 0-100, rounded. 100 only when every item is done, never by rounding up. */
  percent: number
  clearancesTotal: number
  clearancesDone: number
}

export function checklistProgress(items: readonly ChecklistItemState[]): ChecklistProgress {
  const total = items.length
  const done = items.filter((i) => i.isDone).length
  const clearances = items.filter((i) => i.itemKind === "CLEARANCE")
  return {
    total,
    done,
    // floor, so 23 of 24 reads 95, never 100.
    percent: total === 0 ? 0 : done === total ? 100 : Math.floor((done / total) * 100),
    clearancesTotal: clearances.length,
    clearancesDone: clearances.filter((i) => i.isDone).length,
  }
}

export interface AssigneeContext {
  employeeId: string
  managerId?: string | null
  /** Head of the employee's OWN department - the manager fallback. */
  departmentHeadId?: string | null
  /** Head of the department a clearance item points at, when it points at one. */
  clearanceDepartmentHeadId?: string | null
}

/**
 * Who owns an item, as an employee id. HR returns null - HR is a pool, so any HR user can act.
 * MANAGER falls back to the head of the employee's own department.
 */
export function resolveAssignee(
  assigneeRole: "HR" | "MANAGER" | "EMPLOYEE" | "DEPARTMENT_HEAD",
  ctx: AssigneeContext,
): string | null {
  switch (assigneeRole) {
    case "EMPLOYEE":
      return ctx.employeeId
    case "MANAGER":
      return ctx.managerId ?? ctx.departmentHeadId ?? null
    case "DEPARTMENT_HEAD":
      return ctx.clearanceDepartmentHeadId ?? null
    case "HR":
    default:
      return null
  }
}

/**
 * A CLEARANCE is signed by its assignee only, or overridden by HR (recorded). A TASK can be
 * ticked by its assignee or any HR-scoped user.
 */
export function canActOnItem(
  item: { itemKind: "TASK" | "CLEARANCE"; assigneeId: string | null },
  actorId: string,
  actorHasWriteScope: boolean,
): boolean {
  if (item.assigneeId && item.assigneeId === actorId) return true
  return actorHasWriteScope
}

/** Derived, not a stored status: an accepted resignation whose last working day hasn't passed. */
export function isServingNotice(
  resignationStatus: string | null | undefined,
  lastWorkingDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (resignationStatus !== "APPROVED" || lastWorkingDate == null) return false
  const last = lastWorkingDate instanceof Date ? lastWorkingDate : new Date(lastWorkingDate)
  if (Number.isNaN(last.getTime())) return false
  // The last working day is itself a working day, so compare on date only.
  const lastUtc = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return nowUtc <= lastUtc
}
