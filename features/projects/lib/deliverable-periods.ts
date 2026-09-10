import { STATUS_ORDER, type DeliverableStatus } from "./deliverable-lifecycle"
import { formatPeriod } from "./delivery-period"

// ─────────────────────────────────────────────────────────────────────────────
// A DELIVERABLE, as the account manager means the word.
//
// They plan "14-18 Sep 2026": four blogs from WEB, two reels from VIDEO. That
// week is the deliverable - one row on the board - and the per-team items are
// what it is made of. On disk each team item is its own row carrying the same
// periodStart/periodEnd, so a deliverable is the set of rows sharing a window,
// and its name is the window. Nothing else is stored for it: a period with a
// separate title would be a second name for a thing that already has one.
//
// Pure, so the rollup (what is a period's status, is it overdue, how much of
// it landed) is tested without a component.
// ─────────────────────────────────────────────────────────────────────────────

/** The fields a row needs for the rollup - the UI row type satisfies it. */
export interface PeriodRowLike {
  periodStart: string | null
  periodEnd: string | null
  status: DeliverableStatus
  quantity: number
  /** How many of `quantity` are made. Counts toward progress on its own. */
  deliveredQuantity: number
  team?: { id: string; name: string } | null
}

/**
 * Where a period is, taken as a whole.
 *
 * Deliberately the same five words as a single row, so the pill on the period
 * row reads the same as the pills inside it.
 */
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
  /**
   * Units actually made, whatever the status says.
   *
   * Summed from each row s own progress rather than counting a DELIVERED row
   * whole: four blogs with one written is one unit made, and a bar that showed
   * nothing until the fourth landed would hide a week of real work.
   */
  made: number
  status: PeriodStatus
  /** The window has closed and something in it is still not made. */
  overdue: boolean
}

export const UNPLANNED_KEY = "__unplanned"

/** Heading for rows logged straight into the ledger with no period behind them. */
export const UNPLANNED_LABEL = "Logged without a plan"

const isMade = (s: DeliverableStatus) => s === "DELIVERED" || s === "ACCEPTED"

// ─── The URL form of a period ────────────────────────────────────────────────
// A deliverable has its own page, so its key has to survive a path segment.
// ".." inside a segment is legal but reads like a parent reference to every
// human who sees it, so the slug joins the two days with "_" instead.

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
 * One status for a set of rows.
 *
 *   any sent back            -> REJECTED   (somebody has to act)
 *   everything accepted      -> ACCEPTED
 *   everything at least made -> DELIVERED
 *   anything started or made -> IN_PROGRESS
 *   nothing touched          -> PLANNED
 *
 * Rejection wins over everything because it is the one state that is waiting
 * on the team, and a period that says "Delivered" while a piece of it is
 * bounced would hide the thing needing attention.
 */
export function derivePeriodStatus(statuses: readonly DeliverableStatus[]): PeriodStatus {
  if (statuses.length === 0) return "PLANNED"
  if (statuses.some((s) => s === "REJECTED")) return "REJECTED"
  if (statuses.every((s) => s === "ACCEPTED")) return "ACCEPTED"
  if (statuses.every(isMade)) return "DELIVERED"
  if (statuses.some((s) => s !== "PLANNED")) return "IN_PROGRESS"
  return "PLANNED"
}

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`)

/**
 * Fold rows into their periods, newest first, with the unplanned bucket last.
 *
 * `today` is yyyy-MM-dd so "overdue" is a plain string comparison, the same
 * way the rest of the ledger reads dates - and so a test can pin it.
 */
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
    // Overdue is about the window, not the deadline on any one row: the week
    // is over and the client is still waiting on part of it.
    p.overdue = Boolean(p.end && p.end < today && !isMade(p.status))
  }

  return [...map.values()].sort((a, b) => {
    if (a.key === UNPLANNED_KEY) return 1
    if (b.key === UNPLANNED_KEY) return -1
    // Newest window first; same start, the shorter window first.
    return b.start!.localeCompare(a.start!) || a.end!.localeCompare(b.end!)
  })
}

// ─── Reading one period ──────────────────────────────────────────────────────

/** Units and items sitting at one status. */
export interface StatusUnits {
  status: DeliverableStatus
  units: number
  items: number
}

/**
 * Units and items per status, in reading order, zeroes included.
 *
 * Units, not items, is the headline number everywhere else - "10 product
 * pages" logged once is ten - so the tracker counts the way its own progress
 * bar counts. Items come too, because four units spread over four rows is a
 * different day's work from one row of four.
 */
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

/**
 * One period split by team, in the order the teams first appear.
 *
 * The tabs and the tracker above them both read a period team by team, and
 * working it out twice is two chances for a tab's count and the bar beside it
 * to disagree.
 */
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
