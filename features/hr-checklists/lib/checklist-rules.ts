// =============================================================================
// Checklist rules - the decisions, with no database attached.
// =============================================================================
// PURE. Everything here takes plain values and returns plain values, so the
// three rules that actually matter can be tested directly rather than inferred
// from a service that also writes rows and sends email.
//
// The one that matters most is canComplete(): it is the enforcement behind
// "until all department clearances are signed, relieving will not be issued".
// =============================================================================

/** Milliseconds in a day. Dates here are date-only, so no DST arithmetic. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When an item is due.
 *
 * `offsetDays` is relative to the instance anchor - joining date for onboarding,
 * last working day for an exit, where a negative offset means "before they go".
 * Returns null when there is no anchor (an employee created with no joining
 * date) or the item carries no offset: a checklist with no dates is still a
 * usable checklist, and a made-up date is worse than none.
 */
export function itemDueDate(
  anchorDate: Date | string | null | undefined,
  offsetDays: number | null | undefined,
): Date | null {
  if (anchorDate == null || offsetDays == null) return null
  const anchor = anchorDate instanceof Date ? anchorDate : new Date(anchorDate)
  if (Number.isNaN(anchor.getTime())) return null
  // Build from the UTC calendar parts: these columns are DATE, and shifting by
  // a local-time offset can land the result on the previous day.
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

/**
 * May this checklist be completed?
 *
 * Only a required CLEARANCE blocks. A required TASK does not: HR completing an
 * exit with an unticked "team farewell email" is a tidiness problem, whereas
 * completing one without Finance's sign-off issues a relieving letter to
 * somebody who may still owe the company money. The document draws exactly that
 * line, and so does this.
 */
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
    // Math.floor, so 23 of 24 reads 95 and not 100. A checklist that says it is
    // finished when it is not is the one number nobody may round.
    percent: total === 0 ? 0 : done === total ? 100 : Math.floor((done / total) * 100),
    clearancesTotal: clearances.length,
    clearancesDone: clearances.filter((i) => i.isDone).length,
  }
}

/** The employee facts assignee resolution needs. */
export interface AssigneeContext {
  employeeId: string
  managerId?: string | null
  /** Head of the employee's OWN department - the manager fallback. */
  departmentHeadId?: string | null
  /** Head of the department a clearance item points at, when it points at one. */
  clearanceDepartmentHeadId?: string | null
}

/**
 * Who owns an item, as a real employee id.
 *
 * Returns null for HR deliberately: HR is a pool, not a person, and every
 * holder of the write scope can action those. Pinning them to one HR user would
 * mean an exit stalls because somebody is on leave.
 *
 * MANAGER falls back to the head of the employee's own department. People do
 * exist with no manager set - a department head, an early hire - and their exit
 * must still route to somebody rather than silently to nobody.
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
 * May this person tick this item?
 *
 * A CLEARANCE is the assignee's to sign and nobody else's - that is what makes
 * it a sign-off rather than a checkbox. HR can still override, because somebody
 * has to be able to finish an exit when a department head has left or is
 * unreachable, and an override is recorded against the HR user who did it.
 *
 * An ordinary TASK is looser: its assignee, or any HR-scoped user, since an
 * unassigned (HR-pool) task belongs to whoever picks it up.
 */
export function canActOnItem(
  item: { itemKind: "TASK" | "CLEARANCE"; assigneeId: string | null },
  actorId: string,
  actorHasWriteScope: boolean,
): boolean {
  if (item.assigneeId && item.assigneeId === actorId) return true
  return actorHasWriteScope
}

/**
 * Is this employee serving notice?
 *
 * Deliberately derived rather than stored. `EmployeeStatus` gains no
 * SERVING_NOTICE value, so no existing status filter anywhere in the app
 * quietly changes meaning - an accepted resignation with a last working day
 * that has not arrived yet IS the notice period.
 */
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
