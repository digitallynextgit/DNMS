import { OYD_LEVELS, type OydLevel } from "../constants"

/** HR and admins confirm, remove and see every flag; admin_ (the hidden owner) included. */
export const OYD_HR_ROLES: readonly string[] = ["admin_", "admin", "hr_manager", "hr_employee"]

export function isOydHrRoles(roles: readonly string[]): boolean {
  return roles.some((r) => OYD_HR_ROLES.includes(r))
}

/** The caller, and the people they are Reporting (or dotted) Manager of. */
export interface OydViewer {
  id: string
  isHr: boolean
  managedIds: readonly string[]
}

export interface OydFlagFacts {
  employeeId: string
  raisedById: string | null
  status: string
  removedAt: Date | string | null
}

const manages = (v: OydViewer, employeeId: string) => v.managedIds.includes(employeeId)

/** A flag counts towards the level only once confirmed, and stops counting when removed. */
export function countsTowardsLevel(f: Pick<OydFlagFacts, "status" | "removedAt">): boolean {
  return f.status === "CONFIRMED" && !f.removedAt
}

/** HR and their manager see everything about them; the raiser sees their own; the employee sees
 *  their confirmed flags (removed ones too, for the history) but never pending or rejected ones. */
export function canSeeFlag(f: OydFlagFacts, v: OydViewer): boolean {
  if (v.isHr || manages(v, f.employeeId)) return true
  if (f.raisedById !== null && f.raisedById === v.id) return true
  return f.employeeId === v.id && f.status === "CONFIRMED"
}

export function canReviewFlag(f: OydFlagFacts, v: OydViewer): boolean {
  if (f.status !== "PENDING" || f.removedAt || f.employeeId === v.id) return false
  return v.isHr || manages(v, f.employeeId)
}

/** The person who raised it, HR or an admin - never the flagged person themselves. */
export function canRemoveFlag(f: OydFlagFacts, v: OydViewer): boolean {
  if (f.removedAt || f.status === "REJECTED" || f.employeeId === v.id) return false
  return v.isHr || (f.raisedById !== null && f.raisedById === v.id)
}

/** A flag from HR or the employee's own Reporting Manager needs no second confirmation. */
export function confirmsAtOnce(v: OydViewer, employeeId: string): boolean {
  return v.isHr || manages(v, employeeId)
}

/** The OYD step for this many active flags; null for none, capped at the last step. */
export function levelFor(activeCount: number): OydLevel | null {
  if (activeCount <= 0) return null
  return OYD_LEVELS[Math.min(activeCount, OYD_LEVELS.length) - 1] ?? null
}

export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`
}
