// =============================================================================
// Holidays, leave, WFH and floating holidays.
//
// Everything here is dated relative to today. Each approved/pending day off is
// also recorded in ctx.away, so attendance (next module) leaves those days
// without a punch and payroll pays them correctly - the three never disagree.
//
// Rules mirrored from the app (features/leave, features/wfh):
//   - leave totalDays = calendar days inclusive (the sandwich rule)
//   - a regular employee's PENDING request: approvalStage "HR",
//     currentApproverId = their manager; HR/admin applicants: stage "ADMIN"
//   - decided requests: approvalStage/currentApproverId null; managerDecision
//     only when the manager (not HR/admin) decided
//   - balances: UPFRONT, accrued = allocated; used/pending = sums of the
//     APPROVED/PENDING requests; admins and people on probation get none
//   - WFH: totalDays = working days; no overlapping active ranges per person;
//     one ordinary WFH day a month (emergencies extra)
// =============================================================================

import { DEMO_PEOPLE, demoPerson } from "@/features/help/demo/dataset"
import {
  addDays,
  at,
  dayKey,
  firstOfMonth,
  idOf,
  lastOfMonth,
  isWeekend,
  make,
  makeMany,
  markAway,
  mondayOf,
  workingDays,
  ymd,
  type DemoContext,
} from "./context"

// ── Holidays ─────────────────────────────────────────────────────────────────

type HolidayDef = { name: string; date: [number, number]; optional: boolean; description?: string }

/** India 2026 - matches the founding company's calendar: 8 fixed + 12 floating. */
const HOLIDAYS_2026: HolidayDef[] = [
  { name: "Republic Day", date: [1, 26], optional: false },
  { name: "Holi", date: [3, 4], optional: false },
  { name: "Bakrid (Eid-ul-Adha)", date: [5, 28], optional: false },
  { name: "Independence Day", date: [8, 15], optional: false },
  { name: "Mahatma Gandhi Jayanti", date: [10, 2], optional: false },
  { name: "Dussehra", date: [10, 20], optional: false },
  { name: "Diwali", date: [11, 8], optional: false },
  { name: "Christmas", date: [12, 25], optional: false },
  { name: "Makar Sankranti / Pongal", date: [1, 14], optional: true },
  { name: "Maha Shivratri", date: [2, 15], optional: true },
  { name: "Eid-ul-Fitr", date: [3, 21], optional: true },
  { name: "Ram Navami", date: [3, 26], optional: true },
  { name: "Good Friday", date: [4, 3], optional: true },
  { name: "Buddha Purnima", date: [5, 1], optional: true },
  { name: "Muharram", date: [6, 26], optional: true },
  { name: "Raksha Bandhan", date: [8, 28], optional: true },
  { name: "Janmashtami", date: [9, 4], optional: true },
  { name: "Ganesh Chaturthi", date: [9, 14], optional: true },
  { name: "Govardhan Puja", date: [11, 9], optional: true },
  { name: "Bhai Dooj", date: [11, 11], optional: true },
]

/** India 2027 (festival dates follow the lunar calendar, so they move). */
const HOLIDAYS_2027: HolidayDef[] = [
  { name: "Republic Day", date: [1, 26], optional: false },
  { name: "Holi", date: [3, 22], optional: false },
  { name: "Bakrid (Eid-ul-Adha)", date: [5, 17], optional: false },
  { name: "Independence Day", date: [8, 15], optional: false },
  { name: "Mahatma Gandhi Jayanti", date: [10, 2], optional: false },
  { name: "Dussehra", date: [10, 9], optional: false },
  { name: "Diwali", date: [10, 29], optional: false },
  { name: "Christmas", date: [12, 25], optional: false },
  { name: "Makar Sankranti / Pongal", date: [1, 14], optional: true },
  { name: "Maha Shivratri", date: [3, 6], optional: true },
  { name: "Eid-ul-Fitr", date: [3, 10], optional: true },
  { name: "Good Friday", date: [3, 26], optional: true },
  { name: "Ram Navami", date: [4, 15], optional: true },
  { name: "Buddha Purnima", date: [5, 20], optional: true },
  { name: "Muharram", date: [6, 16], optional: true },
  { name: "Raksha Bandhan", date: [8, 17], optional: true },
  { name: "Janmashtami", date: [8, 25], optional: true },
  { name: "Ganesh Chaturthi", date: [9, 4], optional: true },
  { name: "Govardhan Puja", date: [10, 30], optional: true },
  { name: "Bhai Dooj", date: [10, 31], optional: true },
]

function holidaysFor(year: number): HolidayDef[] {
  if (year === 2026) return HOLIDAYS_2026
  if (year === 2027) return HOLIDAYS_2027
  // Any other year: the 2026 calendar's month/day - close enough for a demo.
  return HOLIDAYS_2026
}

const HOLIDAY_NOTES: Record<string, string> = {
  Diwali: "Office closed. Diwali celebrations on the last working day before.",
  Dussehra: "Office closed.",
  Christmas: "Office closed. Secret Santa on the 24th!",
  "Independence Day": "Office closed. Flag hoisting at 9:00 AM for those in town.",
}

/** This year's and next year's holidays. Fills ctx.holidayKeys / floatingHoliday. */
export async function seedHolidays(ctx: DemoContext): Promise<void> {
  const year = ctx.today.getUTCFullYear()
  const rows: Record<string, unknown>[] = []
  for (const y of [year, year + 1]) {
    for (const h of holidaysFor(y)) {
      rows.push({
        name: h.name,
        date: ymd(y, h.date[0], h.date[1]),
        isOptional: h.optional,
        description:
          HOLIDAY_NOTES[h.name] ?? (h.optional ? "Floating holiday - pick any 3." : null),
      })
    }
  }
  await makeMany(ctx, "holiday", rows)
  // Re-read for ids (createMany returns none).
  const { db } = await import("@/server/db")
  const made = await db.holiday.findMany({
    select: { id: true, date: true, name: true, isOptional: true },
  })
  for (const h of made) {
    ctx.holidayNames.set(dayKey(h.date), h.name)
    if (h.isOptional) ctx.floatingHoliday.set(dayKey(h.date), h.id)
    else ctx.holidayKeys.add(dayKey(h.date))
  }
  const fixed = made.filter((h) => !h.isOptional).length
  ctx.summary.add("Holidays", `holidays ${year}-${year + 1} (fixed)`, fixed)
  ctx.summary.add("Holidays", `holidays ${year}-${year + 1} (floating)`, made.length - fixed)
}

// ── Leave + WFH plan ─────────────────────────────────────────────────────────

/**
 * A day in week `w` relative to this week (0 = this week, -1 = last week),
 * `dow` 0 = Monday .. 4 = Friday. Rolls forward past a weekend or holiday.
 */
function wk(ctx: DemoContext, w: number, dow: number): Date {
  let d = addDays(mondayOf(ctx.today), w * 7 + dow)
  while (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) d = addDays(d, 1)
  return d
}

/** The first working day after today. */
function nextWorkingDay(ctx: DemoContext): Date {
  let d = addDays(ctx.today, 1)
  while (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) d = addDays(d, 1)
  return d
}

/** `n` working days starting at `start` -> [start, end]. */
function span(ctx: DemoContext, start: Date, n: number): [Date, Date] {
  let end = start
  let left = n - 1
  while (left > 0) {
    end = addDays(end, 1)
    if (!isWeekend(end) && !ctx.holidayKeys.has(dayKey(end))) left--
  }
  return [start, end]
}

/** `d`, or `minutesAgo` before now if `d` would be in the future. */
function notAfter(ctx: DemoContext, d: Date, minutesAgo: number): Date {
  const cap = new Date(ctx.now.getTime() - minutesAgo * 60_000)
  return d > cap ? cap : d
}

const calendarDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1

/**
 * Fixed days in the CALENDAR MONTH BEFORE today for Priya (the employee
 * persona), so the "previous month" attendance screenshots always show the
 * same mix - never left to the random generator. Working days only, and never
 * a floating holiday, so nothing here can collide with a pick.
 *
 * GUIDE REQUIREMENT (self-service): in that month Priya has >= 1 present day,
 * a half day, a missing punch-out, an approved leave day, an approved WFH day,
 * and a rejected WFH request.
 */
export function priyaAnchors(ctx: DemoContext) {
  const prev = workingDays(ctx, firstOfMonth(ctx.today, -1), lastOfMonth(ctx.today, -1)).filter(
    (d) => !ctx.floatingHoliday.has(dayKey(d)),
  )
  const before = workingDays(ctx, firstOfMonth(ctx.today, -2), lastOfMonth(ctx.today, -2)).filter(
    (d) => !ctx.floatingHoliday.has(dayKey(d)),
  )
  const pick = (list: Date[], i: number) => list[Math.min(i, list.length - 1)]!
  return {
    sickLeave: pick(prev, 3), // approved SL, 1 day
    halfDay: pick(prev, 6), // HALF_DAY punch
    wfhApproved: pick(prev, 8), // approved WFH
    missingPunch: pick(prev, 11), // check-in only
    wfhRejected: pick(prev, 13), // rejected WFH - she came in
    casualLeave: pick(before, 10), // approved CL, 2 days, the month before
    // No punch and no request - one loss-of-pay day on that month's PAID payslip.
    absent: pick(before, 16),
  }
}

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

interface LeavePlan {
  who: string
  code: "CL" | "SL" | "EL" | "LWP"
  start: Date
  days: number
  status: LeaveStatus
  reason: string
  /** Who decided (approved/rejected). */
  by?: string
  rejectionReason?: string
  /** Applied this many days before the start (negative = after, e.g. sick leave). */
  appliedBefore?: number
  lateNoticePenalty?: boolean
}

const HR_ROLES = new Set(["hr_manager", "hr_employee", "admin"])

function leavePlan(ctx: DemoContext): LeavePlan[] {
  const w = (week: number, dow: number) => wk(ctx, week, dow)
  const priya = priyaAnchors(ctx)
  return [
    // ── Pending: Priya's casual leave next week (for Rohan), Rohan's team ─────
    {
      who: "priya",
      code: "CL",
      start: w(1, 3),
      days: 2,
      status: "PENDING",
      reason: "Cousin's wedding in Jaipur - travelling Wednesday night.",
      appliedBefore: 8,
    },
    {
      who: "ananya",
      code: "CL",
      start: w(2, 0),
      days: 1,
      status: "PENDING",
      reason: "Travelling home to Lucknow for Dussehra.",
      appliedBefore: 12,
    },
    {
      who: "vikram",
      code: "EL",
      start: w(4, 0),
      days: 2,
      status: "PENDING",
      reason: "Family trip before Diwali.",
      appliedBefore: 26,
    },
    {
      who: "arjun",
      code: "SL",
      start: w(0, 0),
      days: 1,
      status: "PENDING",
      reason: "Fever and body ache - doctor advised two days' rest.",
      appliedBefore: -1,
    },
    // ── Pending for the admin's queue ──────────────────────────────────────────
    {
      who: "meera",
      code: "CL",
      start: w(1, 0),
      days: 1,
      status: "PENDING",
      reason: "Bank and property registration work.",
      appliedBefore: 4,
    },
    {
      who: "neha",
      code: "CL",
      start: w(2, 3),
      days: 2,
      status: "PENDING",
      reason: "House shifting.",
      appliedBefore: 14,
    },
    // ── Rejected / cancelled ─────────────────────────────────────────────────
    {
      who: "sneha",
      code: "CL",
      start: w(-2, 3),
      days: 1,
      status: "REJECTED",
      by: "rohan",
      reason: "Personal work.",
      rejectionReason: "Sunmeadow Organics campaign goes live that day - please pick another date.",
      appliedBefore: 5,
    },
    {
      who: "ishaan",
      code: "CL",
      start: w(1, 2),
      days: 2,
      status: "REJECTED",
      by: "neha",
      reason: "Short break.",
      rejectionReason:
        "Two client pitches are booked that week - please move it to the week after.",
      appliedBefore: 9,
    },
    {
      who: "kavya",
      code: "CL",
      start: w(-3, 4),
      days: 1,
      status: "CANCELLED",
      reason: "Personal work.",
      appliedBefore: 6,
    },
    // ── Approved, in the last few weeks ────────────────────────────────────────
    {
      who: "priya",
      code: "SL",
      start: priya.sickLeave,
      days: 1,
      status: "APPROVED",
      by: "rohan",
      reason: "Migraine.",
      appliedBefore: 0,
    },
    {
      who: "priya",
      code: "CL",
      start: priya.casualLeave,
      days: 2,
      status: "APPROVED",
      by: "rohan",
      reason: "Family function in Chandigarh.",
      appliedBefore: 10,
    },
    {
      who: "ananya",
      code: "EL",
      start: w(-6, 0),
      days: 2,
      status: "APPROVED",
      by: "neha",
      reason: "Short holiday in Rishikesh.",
      appliedBefore: 20,
    },
    {
      who: "vikram",
      code: "CL",
      start: w(-2, 0),
      days: 1,
      status: "APPROVED",
      by: "rohan",
      reason: "Bike servicing and RTO work.",
      appliedBefore: 3,
    },
    // A Sunmeadow teammate away one day this week (shows on the task sheet).
    {
      who: "vikram",
      code: "CL",
      start: w(0, 4),
      days: 1,
      status: "APPROVED",
      by: "rohan",
      reason: "Cousin's engagement.",
      appliedBefore: 9,
    },
    {
      who: "sneha",
      code: "SL",
      start: w(-1, 2),
      days: 1,
      status: "APPROVED",
      by: "rohan",
      reason: "Food poisoning.",
      appliedBefore: -1,
      lateNoticePenalty: true,
    },
    {
      who: "arjun",
      code: "CL",
      start: w(-4, 4),
      days: 1,
      status: "APPROVED",
      by: "rohan",
      reason: "Sister's convocation.",
      appliedBefore: 7,
    },
    {
      who: "karthik",
      code: "EL",
      start: w(-8, 0),
      days: 3,
      status: "APPROVED",
      by: "aarav",
      reason: "Trip to Coorg.",
      appliedBefore: 21,
    },
    {
      who: "meera",
      code: "CL",
      start: w(-4, 0),
      days: 1,
      status: "APPROVED",
      by: "aarav",
      reason: "Parent-teacher meeting.",
      appliedBefore: 5,
    },
    {
      who: "kavya",
      code: "SL",
      start: w(-2, 1),
      days: 1,
      status: "APPROVED",
      by: "aarav",
      reason: "Viral fever.",
      appliedBefore: 0,
    },
    {
      who: "pooja",
      code: "CL",
      start: w(-3, 0),
      days: 2,
      status: "APPROVED",
      by: "rohan",
      reason: "Family visiting from Pune.",
      appliedBefore: 9,
    },
    {
      who: "pooja",
      code: "LWP",
      start: w(-7, 2),
      days: 1,
      status: "APPROVED",
      by: "neha",
      reason: "Personal emergency (casual leave exhausted).",
      appliedBefore: 0,
    },
    {
      who: "rohan",
      code: "EL",
      start: w(-5, 2),
      days: 3,
      status: "APPROVED",
      by: "aarav",
      reason: "Vacation - Goa.",
      appliedBefore: 30,
    },
    {
      who: "neha",
      code: "CL",
      start: w(-6, 4),
      days: 1,
      status: "APPROVED",
      by: "aarav",
      reason: "Personal work.",
      appliedBefore: 6,
    },
    {
      who: "ishaan",
      code: "CL",
      start: w(-7, 3),
      days: 1,
      status: "APPROVED",
      by: "neha",
      reason: "Visa appointment.",
      appliedBefore: 10,
    },
    // ── Approved, coming up ─────────────────────────────────────────────────────
    {
      who: "karthik",
      code: "CL",
      start: w(3, 4),
      days: 1,
      status: "APPROVED",
      by: "aarav",
      reason: "Long weekend with family.",
      appliedBefore: 14,
    },
    {
      who: "rohan",
      code: "CL",
      start: w(3, 0),
      days: 1,
      status: "APPROVED",
      by: "aarav",
      reason: "Personal work.",
      appliedBefore: 10,
    },
  ].map((p) => ({ ...p, code: p.code as LeavePlan["code"], status: p.status as LeaveStatus }))
}

interface WfhPlan {
  who: string
  day: Date
  status: LeaveStatus
  reason: string
  by?: string
  rejectionReason?: string
  emergency?: boolean
  appliedBefore?: number
}

function wfhPlan(ctx: DemoContext): WfhPlan[] {
  const w = (week: number, dow: number) => wk(ctx, week, dow)
  const priya = priyaAnchors(ctx)
  return [
    // Priya: a request waiting on Rohan, plus an approved and a rejected one last month.
    {
      who: "priya",
      day: w(1, 1),
      status: "PENDING",
      reason: "Electrician and plumber visit at home - will be online all day.",
      appliedBefore: 6,
    },
    {
      who: "priya",
      day: priya.wfhApproved,
      status: "APPROVED",
      by: "rohan",
      reason: "Gas pipeline installation at home.",
      appliedBefore: 4,
    },
    {
      who: "priya",
      day: priya.wfhRejected,
      status: "REJECTED",
      by: "rohan",
      reason: "Want to finish the FitLife moodboards from home.",
      rejectionReason: "FitLife kickoff workshop is in the office that day - need you in the room.",
      appliedBefore: 2,
    },
    {
      who: "ishaan",
      day: w(0, 4),
      status: "PENDING",
      reason: "Car at the service centre in Faridabad.",
      emergency: true,
      appliedBefore: 2,
    },
    // GUIDE REQUIREMENT (review): an EMERGENCY pending request in Rohan's team view.
    {
      who: "sneha",
      day: nextWorkingDay(ctx),
      status: "PENDING",
      reason:
        "Mother unwell - need to be at home, will handle scheduling and community replies online.",
      emergency: true,
      appliedBefore: 0,
    },
    {
      who: "kavya",
      day: w(1, 2),
      status: "PENDING",
      reason: "Waiting for a furniture delivery.",
      appliedBefore: 5,
    },
    // Approved, past.
    {
      who: "karthik",
      day: w(-1, 3),
      status: "APPROVED",
      by: "aarav",
      reason: "Server migration window ran late - working from home next day.",
    },
    {
      who: "ananya",
      day: w(-3, 2),
      status: "APPROVED",
      by: "rohan",
      reason: "Focused writing day for the UrbanNest blog series.",
    },
    {
      who: "ananya",
      day: w(-7, 1),
      status: "APPROVED",
      by: "rohan",
      reason: "Society water supply shutdown.",
    },
    {
      who: "vikram",
      day: w(-4, 3),
      status: "APPROVED",
      by: "rohan",
      reason: "Technical SEO audit - deep work day.",
    },
    {
      who: "sneha",
      day: w(-6, 0),
      status: "APPROVED",
      by: "neha",
      reason: "Not feeling well, but can manage posting from home.",
    },
    {
      who: "meera",
      day: w(-2, 4),
      status: "APPROVED",
      by: "aarav",
      reason: "Month-end reconciliation from home.",
    },
    {
      who: "rohan",
      day: w(-3, 0),
      status: "APPROVED",
      by: "aarav",
      reason: "Client call with FitLife late evening.",
    },
    {
      who: "pooja",
      day: w(-1, 0),
      status: "APPROVED",
      by: "rohan",
      reason: "Handover documentation.",
    },
    {
      who: "neha",
      day: w(-5, 4),
      status: "APPROVED",
      by: "aarav",
      reason: "Payroll inputs - quiet day needed.",
    },
    // Approved, coming up.
    {
      who: "arjun",
      day: w(1, 0),
      status: "APPROVED",
      by: "rohan",
      reason: "Editing day - no shoot scheduled.",
    },
    // Rejected.
    {
      who: "arjun",
      day: w(-2, 2),
      status: "REJECTED",
      by: "rohan",
      reason: "Want to edit from home.",
      rejectionReason: "Studio shoot for Sunmeadow that day - need you on set.",
    },
  ]
}

/**
 * Floating-holiday picks, by POSITION relative to today so they stay sensible
 * whenever the seed runs: past[0] = the most recent floating holiday already
 * gone, future[0] = the next one coming up.
 *
 * GUIDE REQUIREMENT (calendar): Priya has an approved and a pending pick (2 of
 * her 3) and the NEXT floating holiday (future[0]) is left for her to pick;
 * Rohan has a pending request from a direct report (Ananya) in his inbox.
 */
type FloatingPick = {
  who: string
  when: ["past" | "future", number]
  status: LeaveStatus
  managerOk?: boolean
  reason?: string
}
const FLOATING_PICKS: FloatingPick[] = [
  { who: "priya", when: ["past", 0], status: "APPROVED" },
  {
    who: "priya",
    when: ["future", 1],
    status: "PENDING",
    managerOk: true,
    reason: "Bhai Dooj at home with family.",
  },
  { who: "ananya", when: ["past", 1], status: "APPROVED" },
  { who: "ananya", when: ["future", 0], status: "PENDING", reason: "Festival at home in Lucknow." },
  { who: "vikram", when: ["past", 0], status: "APPROVED" },
  { who: "karthik", when: ["past", 0], status: "APPROVED" },
  { who: "karthik", when: ["future", 1], status: "PENDING" },
  { who: "sneha", when: ["past", 2], status: "APPROVED" },
  { who: "meera", when: ["past", 1], status: "APPROVED" },
  { who: "meera", when: ["past", 2], status: "APPROVED" },
  { who: "kavya", when: ["future", 0], status: "PENDING" },
  { who: "neha", when: ["past", 4], status: "APPROVED" },
  { who: "arjun", when: ["past", 2], status: "REJECTED", reason: "Two shoots booked that day." },
]

/** Annual entitlement by leave code. */
const ENTITLEMENT: Record<string, number> = { CL: 7, SL: 7, EL: 14 }

const roundHalf = (n: number) => Math.round(n * 2) / 2

/**
 * Confirmation (accrual start): confirmationDate, else joining + probation.
 * Months from that month to December are eligible; EL starts 6 months later.
 */
function allocationFor(
  ctx: DemoContext,
  code: string,
  joined: Date,
  probationMonths: number,
): number {
  const year = ctx.today.getUTCFullYear()
  const confirm = new Date(
    Date.UTC(joined.getUTCFullYear(), joined.getUTCMonth() + probationMonths, joined.getUTCDate()),
  )
  const start =
    code === "EL"
      ? new Date(
          Date.UTC(confirm.getUTCFullYear(), confirm.getUTCMonth() + 6, confirm.getUTCDate()),
        )
      : confirm
  if (start > ctx.today) return 0
  const eligible = start.getUTCFullYear() < year ? 12 : 12 - start.getUTCMonth()
  return roundHalf(((ENTITLEMENT[code] ?? 0) * eligible) / 12)
}

export async function seedTimeOff(ctx: DemoContext): Promise<void> {
  const { db } = await import("@/server/db")
  const M = "Leave & WFH"
  const year = ctx.today.getUTCFullYear()
  const r = ctx.rand

  // ── leave types (provisioning made CL/SL/EL/LWP) + policy matrix ───────────
  const types = await db.leaveType.findMany({ select: { id: true, code: true } })
  for (const t of types) ctx.leaveType[t.code] = t.id
  const descriptions: Record<string, string> = {
    CL: "For personal work and short absences. Apply at least 3 days in advance.",
    SL: "For illness. A medical certificate is needed for more than 2 consecutive days.",
    EL: "Planned vacation. Unused days carry forward (up to 22).",
    LWP: "Unpaid leave once the paid balance is exhausted.",
  }
  for (const t of types) {
    if (descriptions[t.code]) {
      await db.leaveType.update({
        where: { id: t.id },
        data: { description: descriptions[t.code] },
      })
    }
  }
  const policy: [string, string, number][] = [
    ["FULL_TIME", "CL", 7],
    ["FULL_TIME", "SL", 7],
    ["FULL_TIME", "EL", 14],
    ["FULL_TIME", "LWP", 0],
    ["CONTRACT", "CL", 5],
    ["CONTRACT", "SL", 5],
    ["CONTRACT", "EL", 0],
    ["CONTRACT", "LWP", 0],
    ["INTERN", "CL", 3],
    ["INTERN", "SL", 3],
    ["INTERN", "EL", 0],
    ["INTERN", "LWP", 0],
  ]
  await makeMany(
    ctx,
    "leavePolicy",
    policy
      .filter(([, code]) => ctx.leaveType[code])
      .map(([employmentType, code, daysPerYear]) => ({
        employmentType,
        leaveTypeId: ctx.leaveType[code],
        daysPerYear,
      })),
  )

  // ── leave requests ─────────────────────────────────────────────────────────
  const plans = leavePlan(ctx)

  // A little older history (earlier this year), so "used" is not just the
  // last few weeks. Before the attendance window, so it never collides.
  const windowStart = firstOfMonth(ctx.today, -2)
  const yearStart = ymd(year, 1, 5)
  const OLD_REASONS: Record<string, string[]> = {
    CL: [
      "Personal work.",
      "Family function.",
      "House-warming at a relative's place.",
      "Bank work.",
    ],
    SL: ["Fever.", "Dental procedure.", "Stomach infection.", "Cold and cough."],
    EL: ["Family vacation.", "Trip to the hills.", "Sister's wedding."],
  }
  for (const p of DEMO_PEOPLE) {
    if (p.role === "admin" || p.joinedDaysAgo < 200) continue
    const n = r.int(1, 3)
    for (let i = 0; i < n; i++) {
      const code = r.pick(["CL", "CL", "SL", "EL"] as const)
      const span_ = (windowStart.getTime() - 14 * 86_400_000 - yearStart.getTime()) / 86_400_000
      let start = addDays(yearStart, Math.floor(r() * span_))
      while (isWeekend(start) || ctx.holidayKeys.has(dayKey(start))) start = addDays(start, 1)
      const by = p.manager ?? "neha"
      plans.push({
        who: p.key,
        code,
        start,
        days: code === "EL" ? 2 : 1,
        status: "APPROVED",
        by: HR_ROLES.has(p.role) ? "aarav" : by,
        reason: r.pick(OLD_REASONS[code] ?? ["Personal work."]),
        appliedBefore: code === "SL" ? 0 : r.int(3, 15),
      })
    }
  }

  // Entitlements, so a plan that would overdraw a balance is dropped (only
  // ever the random older history - the hand-written plan fits).
  const allocated: Record<string, Record<string, number>> = {}
  for (const p of DEMO_PEOPLE) {
    if (p.role === "admin" || p.key === "rahul") continue
    const joined = (await db.employee.findUnique({
      where: { id: idOf(ctx, p.key) },
      select: { dateOfJoining: true, probationMonths: true },
    }))!
    allocated[p.key] = {}
    for (const code of ["CL", "SL", "EL"]) {
      allocated[p.key]![code] = allocationFor(
        ctx,
        code,
        joined.dateOfJoining!,
        joined.probationMonths,
      )
    }
  }
  const carried: Record<string, number> = {}
  for (const p of DEMO_PEOPLE) {
    if (allocated[p.key] && p.joinedDaysAgo > 365 + ctx.today.getUTCMonth() * 30) {
      carried[p.key] = r.pick([2, 3, 4, 5.5, 6])
    }
  }

  const used: Record<string, number> = {}
  const pending: Record<string, number> = {}
  const rows: Record<string, unknown>[] = []
  let byStatus: Record<string, number> = {}
  for (const plan of plans) {
    const person = demoPerson(plan.who)
    const [start, end] = span(ctx, plan.start, plan.days)
    const total = calendarDays(start, end)
    const k = `${plan.who}|${plan.code}`
    const cap =
      plan.code === "LWP"
        ? Infinity
        : (allocated[plan.who]?.[plan.code] ?? 0) +
          (plan.code === "EL" ? (carried[plan.who] ?? 0) : 0)
    const counts = plan.status === "APPROVED" || plan.status === "PENDING"
    if (
      counts &&
      start.getUTCFullYear() === year &&
      (used[k] ?? 0) + (pending[k] ?? 0) + total > cap
    ) {
      continue // would overdraw - skip (random history only)
    }
    if (counts && start.getUTCFullYear() === year) {
      if (plan.status === "APPROVED") used[k] = (used[k] ?? 0) + total
      else pending[k] = (pending[k] ?? 0) + total
    }

    const isHrApplicant = HR_ROLES.has(person.role)
    const decidedByManager =
      plan.by !== undefined && plan.by === person.manager && !HR_ROLES.has(demoPerson(plan.by).role)
    // Applied ahead of time, but never later than a few minutes ago.
    const created = notAfter(ctx, at(addDays(start, -(plan.appliedBefore ?? 5)), "10:20"), 45)
    const decided = notAfter(ctx, at(addDays(created, 1), "12:40"), 20)
    rows.push({
      employeeId: idOf(ctx, plan.who),
      leaveTypeId: ctx.leaveType[plan.code],
      startDate: start,
      endDate: end,
      totalDays: total,
      reason: plan.reason,
      status: plan.status,
      approverId:
        plan.by && plan.status !== "PENDING" && plan.status !== "CANCELLED"
          ? idOf(ctx, plan.by)
          : null,
      approvedAt: plan.status === "APPROVED" ? decided : null,
      rejectionReason: plan.rejectionReason ?? null,
      managerDecision:
        plan.status === "APPROVED" || plan.status === "REJECTED"
          ? decidedByManager
            ? plan.status
            : null
          : null,
      lateNoticePenalty: plan.lateNoticePenalty ?? false,
      approvalStage: plan.status === "PENDING" ? (isHrApplicant ? "ADMIN" : "HR") : null,
      currentApproverId:
        plan.status === "PENDING" && !isHrApplicant && person.manager
          ? idOf(ctx, person.manager)
          : null,
      createdAt: created,
      updatedAt: plan.status === "PENDING" ? created : decided,
    })
    byStatus[plan.status] = (byStatus[plan.status] ?? 0) + 1

    // Days away, for attendance and payroll.
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (isWeekend(d) || ctx.holidayKeys.has(dayKey(d))) continue
      if (plan.status === "APPROVED") {
        markAway(ctx, plan.who, d, plan.code === "LWP" ? "LEAVE_UNPAID" : "LEAVE_PAID")
      } else if (plan.status === "PENDING" && d <= ctx.today) {
        markAway(ctx, plan.who, d, "LEAVE_PENDING")
      }
    }
  }
  await makeMany(ctx, "leaveRequest", rows)
  ctx.summary.add(M, "leave requests", rows.length)
  for (const [s, n] of Object.entries(byStatus)) ctx.summary.add(M, `  leave ${s}`, n)
  byStatus = {}

  // ── balances ───────────────────────────────────────────────────────────────
  const balances: Record<string, unknown>[] = []
  for (const [key, codes] of Object.entries(allocated)) {
    for (const [code, alloc] of Object.entries(codes)) {
      if (alloc <= 0 || !ctx.leaveType[code]) continue
      balances.push({
        employeeId: idOf(ctx, key),
        leaveTypeId: ctx.leaveType[code],
        year,
        allocated: alloc,
        accrued: alloc, // every type is UPFRONT
        used: used[`${key}|${code}`] ?? 0,
        pending: pending[`${key}|${code}`] ?? 0,
        carried: code === "EL" ? (carried[key] ?? 0) : 0,
      })
    }
  }
  await makeMany(ctx, "leaveBalance", balances)
  ctx.summary.add(M, `leave balances (${year})`, balances.length)

  // ── WFH ────────────────────────────────────────────────────────────────────
  const wfhRows: Record<string, unknown>[] = []
  for (const plan of wfhPlan(ctx)) {
    let day = plan.day
    // Never on a day the same person is already away (leave / floating).
    while (
      ctx.away[plan.who]?.has(dayKey(day)) ||
      isWeekend(day) ||
      ctx.holidayKeys.has(dayKey(day))
    ) {
      day = addDays(day, 1)
    }
    const person = demoPerson(plan.who)
    const byManager =
      plan.by !== undefined && plan.by === person.manager && !HR_ROLES.has(demoPerson(plan.by).role)
    const created = notAfter(ctx, at(addDays(day, -(plan.appliedBefore ?? 3)), "09:50"), 50)
    const decided = notAfter(ctx, at(addDays(created, 0), "15:10"), 25)
    const decidedStatus = plan.status === "APPROVED" || plan.status === "REJECTED"
    wfhRows.push({
      employeeId: idOf(ctx, plan.who),
      date: day,
      endDate: day,
      totalDays: 1,
      reason: plan.reason,
      status: plan.status,
      isEmergency: plan.emergency ?? false,
      managerDecision: decidedStatus && byManager ? plan.status : null,
      managerApproverId: decidedStatus && byManager ? idOf(ctx, plan.by!) : null,
      managerApprovedAt: decidedStatus && byManager ? decided : null,
      hrApproverId: decidedStatus && !byManager && plan.by ? idOf(ctx, plan.by) : null,
      hrApprovedAt: decidedStatus && !byManager && plan.by ? decided : null,
      rejectionReason: plan.rejectionReason ?? null,
      createdAt: created,
      updatedAt: decidedStatus ? decided : created,
    })
    byStatus[plan.status] = (byStatus[plan.status] ?? 0) + 1
    if (plan.status === "APPROVED") markAway(ctx, plan.who, day, "WFH")
  }
  await makeMany(ctx, "wfhRequest", wfhRows)
  ctx.summary.add(M, "WFH requests", wfhRows.length)
  for (const [s, n] of Object.entries(byStatus)) ctx.summary.add(M, `  WFH ${s}`, n)

  // ── floating holidays ──────────────────────────────────────────────────────
  const thisYear = [...ctx.floatingHoliday]
    .map(([k, id]) => ({ id, date: new Date(`${k}T00:00:00Z`) }))
    .filter((h) => h.date.getUTCFullYear() === year && !isWeekend(h.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const past = thisYear.filter((h) => h.date < ctx.today).reverse()
  const future = thisYear.filter((h) => h.date > ctx.today)
  const floatRows: Record<string, unknown>[] = []
  const taken = new Set<string>()
  for (const pick of FLOATING_PICKS) {
    const h = (pick.when[0] === "past" ? past : future)[pick.when[1]]
    if (!h || taken.has(`${pick.who}|${h.id}`)) continue // not enough holidays left this year
    taken.add(`${pick.who}|${h.id}`)
    const person = demoPerson(pick.who)
    // Applied ~3 weeks ahead, but never in the future.
    const appliedOn = new Date(
      Math.min(addDays(h.date, -20).getTime(), addDays(ctx.today, -4).getTime()),
    )
    const created = at(appliedOn, "11:30")
    const decided = at(addDays(appliedOn, 2), "16:00")
    const mgrDecided = pick.managerOk || pick.status === "REJECTED"
    floatRows.push({
      employeeId: idOf(ctx, pick.who),
      holidayId: h.id,
      year,
      status: pick.status,
      reason: pick.reason ?? null,
      managerDecision: mgrDecided
        ? pick.status === "REJECTED"
          ? "REJECTED"
          : "APPROVED"
        : pick.status === "APPROVED"
          ? "APPROVED"
          : null,
      managerApproverId:
        (mgrDecided || pick.status === "APPROVED") && person.manager
          ? idOf(ctx, person.manager)
          : null,
      managerApprovedAt:
        mgrDecided || pick.status === "APPROVED" ? at(addDays(appliedOn, 1), "12:00") : null,
      hrApproverId: pick.status === "PENDING" ? null : idOf(ctx, "neha"),
      hrApprovedAt: pick.status === "PENDING" ? null : decided,
      rejectionReason:
        pick.status === "REJECTED" ? "Too many people off from the video team that day." : null,
      reviewedAt: pick.status === "PENDING" ? null : decided,
      createdAt: created,
    })
    if (pick.status === "APPROVED" && !isWeekend(h.date))
      markAway(ctx, pick.who, h.date, "FLOATING")
  }
  await makeMany(ctx, "floatingHolidaySelection", floatRows)
  ctx.summary.add(M, "floating holiday picks", floatRows.length)

  // ── a few unplanned absences (no request at all) ───────────────────────────
  for (const [who, week, dow] of [
    ["ishaan", -3, 2],
    ["arjun", -6, 3],
    ["sneha", -8, 1],
  ] as const) {
    const d = wk(ctx, week, dow)
    if (d >= windowStart && !ctx.away[who]?.has(dayKey(d))) markAway(ctx, who, d, "ABSENT")
  }
  const priyaAbsent = priyaAnchors(ctx).absent
  if (!ctx.away.priya?.has(dayKey(priyaAbsent))) markAway(ctx, "priya", priyaAbsent, "ABSENT")
  void make
  void workingDays
}
