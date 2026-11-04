// The vote rules, pure so they are unit-tested and shared by the service and the UI.

import { HIDDEN_ROLES, SYSTEM_ROLES, VOTE_MANAGER_ROLES } from "@/lib/constants"
import type { VoteEventStatus } from "../types"

export interface EventWindow {
  publishedAt: Date | string | null
  opensAt: Date | string | null
  closesAt: Date | string
  closedAt: Date | string | null
}

const at = (v: Date | string): number => (v instanceof Date ? v : new Date(v)).getTime()

/** Derived from the dates every time it is read, so nothing has to flip a flag on time. */
export function eventStatus(e: EventWindow, now: Date = new Date()): VoteEventStatus {
  if (!e.publishedAt) return "DRAFT"
  if (e.closedAt) return "CLOSED"
  const t = now.getTime()
  if (t >= at(e.closesAt)) return "CLOSED"
  if (e.opensAt && t < at(e.opensAt)) return "UPCOMING"
  return "OPEN"
}

/**
 * Staff vote and can be voted for. An admin who also holds the employee role is staff too;
 * a pure admin account and the hidden owner account never are.
 */
export function isVoterRoles(roles: readonly string[]): boolean {
  if (roles.includes(SYSTEM_ROLES.ADMIN_)) return false
  if (roles.includes(SYSTEM_ROLES.ADMIN)) return roles.includes(SYSTEM_ROLES.EMPLOYEE)
  return true
}

/** Admins and the HR team run events (admin_ always passes). */
export function isVoteManagerRoles(roles: readonly string[]): boolean {
  return (
    roles.some((r) => (HIDDEN_ROLES as readonly string[]).includes(r)) ||
    roles.some((r) => VOTE_MANAGER_ROLES.includes(r))
  )
}

/** An employee option's name: "Dev  Lal" and "Prashant ." read as "Dev Lal" and "Prashant". */
export function employeeLabel(firstName: string, lastName: string): string {
  const last = lastName.trim().replace(/^\.+$/, "")
  return `${firstName} ${last}`.replace(/\s+/g, " ").trim()
}

export function canCastVote(roles: readonly string[], status: VoteEventStatus): boolean {
  return status === "OPEN" && isVoterRoles(roles)
}

export interface Tally {
  counts: Record<string, number>
  total: number
  /** Every option sharing the top count; empty until someone has voted. */
  winners: string[]
}

export function tally(
  optionIds: readonly string[],
  ballots: readonly { optionId: string }[],
): Tally {
  const counts: Record<string, number> = {}
  for (const id of optionIds) counts[id] = 0
  let total = 0
  for (const b of ballots) {
    // A ballot for a removed option no longer counts.
    if (!(b.optionId in counts)) continue
    counts[b.optionId] = (counts[b.optionId] ?? 0) + 1
    total += 1
  }
  const top = Math.max(0, ...Object.values(counts))
  const winners = top === 0 ? [] : optionIds.filter((id) => counts[id] === top)
  return { counts, total, winners }
}
