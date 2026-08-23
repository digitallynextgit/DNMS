import "server-only"

import { db } from "@/server/db"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"

/**
 * PUBLIC attendance snapshot for the marketing homepage. This is served on an
 * unauthenticated page, so it exposes ONLY a minimal, non-sensitive shape:
 * a display name, the check-in time and the status.
 * No ids, emails, photos, departments or contact details are returned.
 */
export interface AttendanceSnapshotRow {
  name: string
  time: string // "HH:MM" (IST) or "—"
  status: string // display label, e.g. "Present"
}

export interface AttendanceSnapshot {
  day: string // weekday of the snapshot, e.g. "Friday"
  date: string // e.g. "22 Aug"
  rows: AttendanceSnapshotRow[]
}

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  LATE: "Late",
  HALF_DAY: "Half-day",
  ON_LEAVE: "On leave",
  ABSENT: "Absent",
  HOLIDAY: "Holiday",
  WEEKEND: "Weekend",
}

const TZ = "Asia/Kolkata"

// First names excluded from the public homepage feed (matched case-insensitively).
const EXCLUDED_FIRST_NAMES = ["Manpreet"]

function displayName(first: string, last: string): string {
  return `${first} ${last ?? ""}`.trim()
}

/**
 * The latest working day's attendance for up to `limit` active employees.
 * We anchor on the most recent day that actually has punches (≤ now), which
 * naturally skips weekends - so on Saturday/Sunday this resolves to Friday's
 * data. Returns null when there is nothing to show (caller falls back to a demo).
 */
export async function getPublicAttendanceSnapshot(limit = 7): Promise<AttendanceSnapshot | null> {
  const activeEmployee = {
    isActive: true,
    status: "ACTIVE" as const,
    ...VISIBLE_EMPLOYEE_FILTER,
    // Never surface these people on the public feed (leadership / opt-outs).
    NOT: { firstName: { in: EXCLUDED_FIRST_NAMES, mode: "insensitive" as const } },
  }

  const latest = await db.attendanceLog.findFirst({
    where: { date: { lte: new Date() }, employee: activeEmployee },
    orderBy: { date: "desc" },
    select: { date: true },
  })
  if (!latest) return null

  const logs = await db.attendanceLog.findMany({
    where: { date: latest.date, employee: activeEmployee },
    select: {
      status: true,
      checkIn: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { checkIn: { sort: "asc", nulls: "last" } }, // present (with punch) first
    take: limit,
  })
  if (logs.length === 0) return null

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  })

  const rows: AttendanceSnapshotRow[] = logs.map((log) => ({
    name: displayName(log.employee.firstName, log.employee.lastName),
    time: log.checkIn ? timeFmt.format(log.checkIn) : "—",
    status: STATUS_LABEL[log.status] ?? log.status,
  }))

  // Stored `date` is a UTC-midnight calendar date, so format its parts in UTC.
  const day = latest.date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
  const date = latest.date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

  return { day, date, rows }
}

// ─── Public holiday calendar ────────────────────────────────────────────────
// Holidays are company-wide, non-personal information - safe to serve publicly.

export interface PublicHoliday {
  day: number // day-of-month (1–31)
  name: string
  optional: boolean
}

/** Company holidays for a given month (`month` is 1–12). Returns [] for bad input. */
export async function getPublicHolidays(year: number, month: number): Promise<PublicHoliday[]> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return []

  // Stored `date` is a UTC-midnight calendar date, so bound the month in UTC.
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1)) // first of next month (exclusive)

  const holidays = await db.holiday.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true, name: true, isOptional: true },
    orderBy: { date: "asc" },
  })

  return holidays.map((h) => ({
    day: h.date.getUTCDate(),
    name: h.name,
    optional: h.isOptional,
  }))
}
