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
 * Who can be on the ballot. Everyone on staff votes, admins included, but only employees are
 * voted for: an admin who also holds the employee role is one; a pure admin account and the
 * hidden owner account never are.
 */
export function isNomineeRoles(roles: readonly string[]): boolean {
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

export interface Ranked<T> {
  item: T
  /** 1 = most votes; ties share a rank (1, 1, 3). */
  rank: number
}

/** Most votes first; ties share a rank and keep their ballot order. */
export function rankByVotes<T extends { votes: number | null; position: number }>(
  items: readonly T[],
): Ranked<T>[] {
  const sorted = [...items].sort(
    (a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.position - b.position,
  )
  let rank = 0
  return sorted.map((item, i) => {
    const prev = sorted[i - 1]
    if (!prev || (prev.votes ?? 0) !== (item.votes ?? 0)) rank = i + 1
    return { item, rank }
  })
}

/** Countdown text for the time left until voting closes: "3h 12m left", "45m left". */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "Closing now"
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins}m left`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return m ? `${h}h ${m}m left` : `${h}h left`
  const d = Math.floor(h / 24)
  const hh = h % 24
  return hh ? `${d}d ${hh}h left` : `${d}d left`
}

/** An employee option's name: "Dev  Lal" and "Prashant ." read as "Dev Lal" and "Prashant". */
export function employeeLabel(firstName: string, lastName: string): string {
  const last = lastName.trim().replace(/^\.+$/, "")
  return `${firstName} ${last}`.replace(/\s+/g, " ").trim()
}

/**
 * Anyone on staff holds one ballot per event while voting is open. Changing it afterwards is a
 * per-event switch; with it off, the first vote is final.
 */
export function canCastVote(
  status: VoteEventStatus,
  alreadyVoted: boolean,
  allowVoteChange: boolean,
): boolean {
  return status === "OPEN" && (!alreadyVoted || allowVoteChange)
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
