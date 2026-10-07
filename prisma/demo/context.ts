// =============================================================================
// Shared plumbing for the demo seed (prisma/seed-demo.ts).
//
// Every module under prisma/demo/ receives one DemoContext: the tenant it is
// writing into, "today" (so every date is relative and the screens never look
// stale), the ids created so far (people, departments, projects...), a seeded
// random generator (so a re-run produces the same story), and the summary the
// script prints at the end.
//
// ── TENANT SAFETY ────────────────────────────────────────────────────────────
// All writes go through `make()` / `makeMany()` below, which stamp `tenantId`
// EXPLICITLY on every row. The tenant guard would stamp it too inside
// runWithTenant, but only on top-level writes and only when enforcement is on;
// writing it ourselves means a row can never fall back to the column DEFAULT,
// which is the founding (real) company. Nested creates are never used.
// =============================================================================

import { db } from "@/server/db"

/** Minutes India is ahead of UTC. The app stores DATE columns as UTC midnights. */
const IST_OFFSET_MIN = 330
const DAY_MS = 86_400_000

export interface DemoContext {
  tenantId: string
  slug: string
  /** Today's IST calendar date as a UTC midnight - the anchor for every DATE column. */
  today: Date
  /** The real current instant. */
  now: Date
  /** person key (dataset.ts) -> employee id */
  emp: Record<string, string>
  /** department name -> id */
  dept: Record<string, string>
  /** role name (admin, hr_manager...) -> id */
  role: Record<string, string>
  /** project key (dataset.ts) -> id */
  project: Record<string, string>
  /** project key -> team name -> team id */
  team: Record<string, Record<string, string>>
  /** client key -> id */
  client: Record<string, string>
  /** Misc ids shared between modules (goal / requirement / team keys). */
  ref: Record<string, string>
  /** "YYYY-MM-DD" of every NON-optional holiday this year and next. */
  holidayKeys: Set<string>
  /** "YYYY-MM-DD" of every holiday (incl. optional) -> name. */
  holidayNames: Map<string, string>
  /** leave type code (CL, SL, EL, LWP...) -> id */
  leaveType: Record<string, string>
  /** holiday "YYYY-MM-DD" -> id, optional (floating) holidays only */
  floatingHoliday: Map<string, string>
  /**
   * Why a person was not in the office on a day: person key -> day key -> kind.
   * Written by the time-off module, read by attendance (no punch on those days)
   * and payroll (paid or not), so the three always agree.
   */
  away: Record<string, Map<string, AwayKind>>
  /** Stored attendance status: person key -> day key -> status. Read by payroll. */
  attendance: Record<string, Map<string, string>>
  rand: Rng
  summary: Summary
}

export type AwayKind =
  | "LEAVE_PAID" // approved CL / SL / EL
  | "LEAVE_UNPAID" // approved LWP
  | "LEAVE_PENDING" // a past day covered by a still-pending request (no punch)
  | "WFH" // approved work from home
  | "FLOATING" // approved floating holiday
  | "ABSENT" // unplanned, no request at all

/** Mark a day as away for a person (first writer wins). */
export function markAway(ctx: DemoContext, key: string, day: Date, kind: AwayKind): void {
  const m = (ctx.away[key] ??= new Map())
  if (!m.has(dayKey(day))) m.set(dayKey(day), kind)
}

export function awayOn(ctx: DemoContext, key: string, day: Date): AwayKind | undefined {
  return ctx.away[key]?.get(dayKey(day))
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** Today's calendar date in India, as a UTC midnight. */
export function istToday(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** UTC midnight for a calendar date. `month` is 1-based. */
export function ymd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function isWeekend(date: Date): boolean {
  const d = date.getUTCDay()
  return d === 0 || d === 6
}

/**
 * The instant `hhmm` IST happens on `day` (a UTC-midnight date).
 * at(day, "09:30") = 04:00Z that day.
 */
export function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number)
  return new Date(day.getTime() + ((h ?? 0) * 60 + (m ?? 0) - IST_OFFSET_MIN) * 60_000)
}

/** Monday of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const dow = date.getUTCDay() // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow)
}

export function firstOfMonth(date: Date, monthsDelta = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsDelta, 1))
}

export function lastOfMonth(date: Date, monthsDelta = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsDelta + 1, 0))
}

/** Working days from..to inclusive: no weekends, no non-optional holidays. */
export function workingDays(ctx: DemoContext, from: Date, to: Date): Date[] {
  const out: Date[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) continue
    out.push(d)
  }
  return out
}

/** The n-th working day after (n > 0) or before (n < 0) `from`, skipping `from` itself. */
export function shiftWorkingDays(ctx: DemoContext, from: Date, n: number): Date {
  let d = from
  let left = Math.abs(n)
  const step = n >= 0 ? 1 : -1
  while (left > 0) {
    d = addDays(d, step)
    if (!isWeekend(d) && !ctx.holidayKeys.has(dayKey(d))) left--
  }
  return d
}

/** An instant `daysAgo` days before now, at IST `hhmm` - for createdAt-style stamps. */
export function stamp(ctx: DemoContext, daysAgo: number, hhmm = "11:00"): Date {
  return at(addDays(ctx.today, -daysAgo), hhmm)
}

// ── Randomness (seeded, so every run tells the same story) ──────────────────

export interface Rng {
  (): number
  int(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1))
  next.pick = (items) => items[Math.floor(next() * items.length)] as (typeof items)[number]
  next.chance = (p) => next() < p
  return next
}

// ── Writes ───────────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>
interface Creator {
  create: (args: { data: AnyRow; select?: AnyRow }) => Promise<unknown>
  createMany: (args: { data: AnyRow[] }) => Promise<{ count: number }>
}

/** The Prisma delegate for a model, by its client name ("leaveRequest"). */
function delegate(model: string): Creator {
  const d = (db as unknown as Record<string, Creator | undefined>)[model]
  if (!d) throw new Error(`No Prisma model "${model}"`)
  return d
}

/** Create one row with tenantId stamped explicitly; returns its id. */
export async function make(ctx: DemoContext, model: string, data: AnyRow): Promise<string> {
  const row = (await delegate(model).create({
    data: { ...data, tenantId: ctx.tenantId },
    select: { id: true },
  })) as { id: string }
  return row.id
}

/**
 * Insert many rows with tenantId stamped explicitly. createMany in chunks (the
 * app uses it on this database); if a chunk fails it falls back to one create
 * per row - the pg-adapter note in prisma/seed.ts - so a run still completes.
 */
export async function makeMany(ctx: DemoContext, model: string, rows: AnyRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const d = delegate(model)
  const stamped = rows.map((r) => ({ ...r, tenantId: ctx.tenantId }))
  let count = 0
  for (let i = 0; i < stamped.length; i += 500) {
    const chunk = stamped.slice(i, i + 500)
    try {
      count += (await d.createMany({ data: chunk })).count
    } catch (err) {
      console.warn(`  createMany on ${model} failed (${(err as Error).message.split("\n")[0]}),`)
      console.warn(`  retrying one row at a time`)
      for (const row of chunk) {
        await d.create({ data: row })
        count++
      }
    }
  }
  return count
}

// ── Summary ──────────────────────────────────────────────────────────────────

export class Summary {
  private readonly rows: { module: string; what: string; count: number }[] = []
  private readonly skipped: { module: string; why: string }[] = []

  add(module: string, what: string, count: number): void {
    this.rows.push({ module, what, count })
  }

  skip(module: string, why: string): void {
    this.skipped.push({ module, why })
  }

  print(): void {
    console.log("\n── Demo workspace summary ─────────────────────────────────────────")
    let current = ""
    for (const r of this.rows) {
      if (r.module !== current) {
        current = r.module
        console.log(`\n${r.module}`)
      }
      console.log(`  ${r.what.padEnd(46)} ${r.count}`)
    }
    if (this.skipped.length > 0) {
      console.log("\nNot seeded")
      for (const s of this.skipped) console.log(`  ${s.module}: ${s.why}`)
    }
  }
}

/** The person-key -> id lookup, throwing on a typo so a module cannot silently skip someone. */
export function idOf(ctx: DemoContext, key: string): string {
  const id = ctx.emp[key]
  if (!id) throw new Error(`Demo person "${key}" has not been created`)
  return id
}
