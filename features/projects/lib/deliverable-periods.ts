import { STATUS_ORDER, type DeliverableStatus } from "./deliverable-lifecycle"
import { formatPeriod } from "./delivery-period"

// A deliverable, to the account manager, is a planned window ("14-18 Sep 2026"): the set of
// per-team rows sharing periodStart/periodEnd. Its name is the window; nothing else is stored.

export interface PeriodRowLike {
  periodStart: string | null
  periodEnd: string | null
  status: DeliverableStatus
  quantity: number
  /** How many of `quantity` are made. Counts toward progress on its own. */
  deliveredQuantity: number
  team?: { id: string; name: string } | null
}

/** The same five words as a single row, so the period pill reads like the pills inside it. */
export type PeriodStatus = DeliverableStatus

export interface DeliverablePeriod<R extends PeriodRowLike = PeriodRowLike> {
  /** Stable across renders: the window, or a marker for the unplanned bucket. */
  key: string
  start: string | null
  end: string | null
  /** "14-18 Sep 2026", "Sep 2026", "10 Sep 2026" - or the unplanned heading. */
  label: string
  rows: R[]
  /** Distinct team names, in the order they first appear. */
  teams: string[]
  /** Units promised - the sum of quantities, not the number of rows. */
  planned: number
  /** Units actually made, summed per row - one of four blogs written counts as one. */
  made: number
  status: PeriodStatus
  /** The window has closed and something in it is still not made. */
  overdue: boolean
}

export const UNPLANNED_KEY = "__unplanned"

/** Heading for rows logged straight into the ledger with no period behind them. */
export const UNPLANNED_LABEL = "Logged without a plan"

const isMade = (s: DeliverableStatus) => s === "DELIVERED" || s === "ACCEPTED"

// URL form of a period: "_" joins the days, since ".." in a path segment reads like a parent ref.

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** "2026-09-07..2026-09-11" -> "2026-09-07_2026-09-11"; the unplanned bucket -> "unplanned". */
export function periodSlug(key: string): string {
  return key === UNPLANNED_KEY ? "unplanned" : key.replace("..", "_")
}

/** The inverse. Null for anything that is not a slug this module produced. */
export function periodKeyFromSlug(slug: string): string | null {
  if (slug === "unplanned") return UNPLANNED_KEY
  const [start, end, ...rest] = slug.split("_")
  if (rest.length > 0 || !start || !end || !DAY.test(start) || !DAY.test(end)) return null
  if (end < start) return null
  return `${start}..${end}`
}

/**
 * One status for a set of rows: any sent back -> REJECTED (it waits on the team, so it wins);
 * all accepted -> ACCEPTED; all made -> DELIVERED; anything touched -> IN_PROGRESS; else PLANNED.
 */
export function derivePeriodStatus(statuses: readonly DeliverableStatus[]): PeriodStatus {
  if (statuses.length === 0) return "PLANNED"
  if (statuses.some((s) => s === "REJECTED")) return "REJECTED"

  // Discarded rows say nothing about the period; only an all-discarded period reads as discarded.
  const live = statuses.filter((s) => s !== "DISCARDED")
  if (live.length === 0) return "DISCARDED"

  if (live.every((s) => s === "ACCEPTED")) return "ACCEPTED"
  if (live.every(isMade)) return "DELIVERED"
  // STUCK counts as touched: the week is underway, something is just blocked.
  if (live.some((s) => s !== "PLANNED")) return "IN_PROGRESS"
  return "PLANNED"
}

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

/** Fold rows into periods, newest first, unplanned last. `today` is yyyy-MM-dd (string compare). */
export function groupIntoPeriods<R extends PeriodRowLike>(
  rows: readonly R[],
  today: string,
): DeliverablePeriod<R>[] {
  const map = new Map<string, DeliverablePeriod<R>>()
  for (const r of rows) {
    const planned = Boolean(r.periodStart && r.periodEnd)
    const key = planned ? `${r.periodStart}..${r.periodEnd}` : UNPLANNED_KEY
    let p = map.get(key)
    if (!p) {
      p = {
        key,
        start: planned ? r.periodStart : null,
        end: planned ? r.periodEnd : null,
        label: planned ? formatPeriod(day(r.periodStart!), day(r.periodEnd!)) : UNPLANNED_LABEL,
        rows: [],
        teams: [],
        planned: 0,
        made: 0,
        status: "PLANNED",
        overdue: false,
      }
      map.set(key, p)
    }
    p.rows.push(r)
    p.planned += r.quantity
    p.made += Math.min(r.deliveredQuantity, r.quantity)
    const team = r.team?.name
    if (team && !p.teams.includes(team)) p.teams.push(team)
  }

  for (const p of map.values()) {
    p.status = derivePeriodStatus(p.rows.map((r) => r.status))
    // Overdue is about the window: it has closed and part of it is still not made.
    p.overdue = Boolean(p.end && p.end < today && !isMade(p.status))
  }

  return [...map.values()].sort((a, b) => {
    if (a.key === UNPLANNED_KEY) return 1
    if (b.key === UNPLANNED_KEY) return -1
    // Newest window first; same start, the shorter window first.
    return b.start!.localeCompare(a.start!) || a.end!.localeCompare(b.end!)
  })
}

export interface StatusUnits {
  status: DeliverableStatus
  units: number
  items: number
}

/** Units and items per status, in reading order, zeroes included. Units are the headline number. */
export function unitsByStatus(rows: readonly PeriodRowLike[]): StatusUnits[] {
  return STATUS_ORDER.map((status) => {
    const at = rows.filter((r) => r.status === status)
    return { status, units: at.reduce((n, r) => n + r.quantity, 0), items: at.length }
  })
}

/** Where an item with no team is filed - see `splitByTeam`. */
export const NO_TEAM_KEY = "__none"

export interface TeamSlice<R> {
  /** The team's id, or `NO_TEAM_KEY`. Stable enough to be a tab value. */
  key: string
  name: string
  rows: R[]
  planned: number
  made: number
  status: PeriodStatus
}

/** One period split by team, in first-appearance order (shared by the tabs and the tracker). */
export function splitByTeam<R extends PeriodRowLike>(rows: readonly R[]): TeamSlice<R>[] {
  const map = new Map<string, TeamSlice<R>>()
  for (const r of rows) {
    const key = r.team?.id ?? NO_TEAM_KEY
    let slice = map.get(key)
    if (!slice) {
      slice = {
        key,
        name: r.team?.name ?? "No team",
        rows: [],
        planned: 0,
        made: 0,
        status: "PLANNED",
      }
      map.set(key, slice)
    }
    slice.rows.push(r)
    slice.planned += r.quantity
    slice.made += Math.min(r.deliveredQuantity, r.quantity)
  }
  for (const slice of map.values()) {
    slice.status = derivePeriodStatus(slice.rows.map((r) => r.status))
  }
  return [...map.values()]
}

/** Made over planned as a whole percentage. Nothing planned is 0%, not NaN. */
export function pctMade(planned: number, made: number): number {
  return planned > 0 ? Math.round((made / planned) * 100) : 0
}
