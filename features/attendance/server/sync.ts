import "server-only"

import { db } from "@/server/db"
import { fetchAttendanceEvents, testDeviceConnection } from "@/features/attendance/server/hikvision"
import { computeAttendanceStatus } from "@/features/attendance/attendance"
import { HIDDEN_ROLES } from "@/lib/constants"

export interface DeviceConfig {
  ipAddress: string
  port: number
  username: string
  password: string
}

/** Thrown when the device can't be reached (e.g. server not on the device's WiFi/LAN). */
export class DeviceUnreachableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DeviceUnreachableError"
  }
}

// A never-synced employee is backfilled from their joining date. The device only
// retains a finite event buffer, so this just caps how far back we ever ask.
const MAX_BACKFILL_DAYS = 730
// History is pulled in small windows, most-recent first, so the latest days are
// always captured even if an older window fails or the device is slow/flaky.
const BATCH_DAYS = 15
// The device clock is IST; days/times are grouped and stored in IST so the app
// shows the same local time the device displayed.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export interface EmployeeSyncResult {
  employeeNo: string
  name?: string
  /** "full" = whole history backfilled, "incremental" = from the last sync day
   *  to today, "skipped" = no biometric code. */
  mode: "full" | "incremental" | "skipped"
  from: string | null
  to: string | null
  synced: number
  error?: string
}

interface SyncEmployee {
  id: string
  employeeNo: string
  deviceId: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfJoining?: Date | null
}

// ─── IST date helpers ───────────────────────────────────────────────────────
// We work in IST "YYYY-MM-DD" day strings so a punch lands on the calendar day
// the employee actually punched (the device is IST), not a UTC-shifted day.

/** The IST calendar day (YYYY-MM-DD) for an instant. */
function istDayStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}
/** Today's IST day (YYYY-MM-DD). */
function istTodayStr(): string {
  return istDayStr(new Date())
}
/** The UTC instant at the start (00:00:00 IST) of an IST day. */
function istDayStartUtc(dayStr: string): Date {
  return new Date(`${dayStr}T00:00:00.000+05:30`)
}
/** The UTC instant at the end (23:59:59 IST) of an IST day. */
function istDayEndUtc(dayStr: string): Date {
  return new Date(`${dayStr}T23:59:59.999+05:30`)
}
/** Shift a YYYY-MM-DD day string by `n` days. */
function addDaysStr(dayStr: string, n: number): string {
  const d = new Date(`${dayStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Upsert one attendance row for an employee + IST day from that day's punches.
 * The day's FIRST punch is the check-in and the LAST is the check-out.
 *
 * A manually corrected record (isManual) is NEVER overwritten - HR's "Correct
 * Punch" edits always win over the device sync.
 */
async function upsertDay(
  employeeId: string,
  deviceId: string,
  istDay: string,
  punches: Date[],
): Promise<"written" | "skipped"> {
  const date = new Date(`${istDay}T00:00:00.000Z`)

  const existing = await db.attendanceLog.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: { isManual: true },
  })
  if (existing?.isManual) return "skipped" // don't clobber a manual correction

  punches.sort((a, b) => a.getTime() - b.getTime())
  const checkIn = punches[0]
  const checkOut = punches.length > 1 ? punches[punches.length - 1] : null
  let workHours: number | null = null
  if (checkIn && checkOut && checkOut > checkIn) {
    workHours =
      Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
  }
  const status = computeAttendanceStatus({ checkIn, workHours })

  await db.attendanceLog.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: {
      employeeId,
      deviceId,
      date,
      checkIn,
      checkOut,
      workHours,
      status,
      isManual: false,
      source: "device",
      notes: "Synced from device",
    },
    update: {
      deviceId,
      checkIn,
      checkOut,
      workHours,
      status,
      source: "device",
      notes: "Synced from device",
    },
  })
  return "written"
}

/**
 * Sync ONE inclusive IST day-range [fromDay, toDay] for an employee: fetch all of
 * their punches in that window, group by IST day, and upsert one row per day.
 * Captures every punch (any auth method, paginated), so heavy punchers (a dozen+
 * a day) are fully recorded. Returns how many days were written + any device error.
 */
async function syncRange(
  emp: SyncEmployee,
  deviceId: string,
  config: DeviceConfig,
  codes: string[],
  codeSet: Set<string>,
  fromDay: string,
  toDay: string,
): Promise<{ synced: number; error?: string }> {
  const start = istDayStartUtc(fromDay)
  const end = istDayEndUtc(toDay)

  const punchesByDay = new Map<string, Date[]>()
  const seen = new Set<string>()
  const errors: string[] = []

  for (const code of codes) {
    // major=5 (access control), minor=0 (all sub-types) so every punch is
    // captured no matter the auth method (face/card/fingerprint).
    const { events, error } = await fetchAttendanceEvents(config, start, end, 5, 0, code)
    if (error) errors.push(error)
    for (const ev of events) {
      if (!codeSet.has(ev.employeeNo)) continue
      const day = istDayStr(ev.timestamp)
      if (day < fromDay || day > toDay) continue // only days inside this window
      const key = `${ev.employeeNo}|${ev.timestamp.getTime()}`
      if (seen.has(key)) continue
      seen.add(key)
      const arr = punchesByDay.get(day)
      if (arr) arr.push(ev.timestamp)
      else punchesByDay.set(day, [ev.timestamp])
    }
  }

  let synced = 0
  for (const [day, punches] of punchesByDay) {
    try {
      if ((await upsertDay(emp.id, deviceId, day, punches)) === "written") synced++
    } catch (e) {
      errors.push(`${day}: ${String(e)}`)
    }
  }
  return { synced, error: errors.length ? errors.join("; ") : undefined }
}

/**
 * Pull ONE employee's punches from a device into the DB.
 *
 *  - Full backfill (first sync, or `opts.full`): walk BACKWARD from today in
 *    15-day windows down to their joining date (capped at the device's retention
 *    window). The most recent window syncs first; if a window fails, we stop
 *    walking further back so a flaky older request can't lose today's data.
 *  - Incremental (the Refresh / Sync button, cron): walk backward to the last
 *    successful sync day (`opts.since`) so any days missed between syncs are
 *    recovered - not just today + yesterday. Defaults to yesterday when unknown.
 *
 * Days are grouped in IST; the day's first punch = check-in, last = check-out.
 * Assumes connectivity was already probed.
 */
export async function syncEmployeeAttendance(
  deviceId: string,
  config: DeviceConfig,
  emp: SyncEmployee,
  opts: { full?: boolean; since?: string } = {},
): Promise<EmployeeSyncResult> {
  const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || undefined
  const codes = Array.from(new Set([emp.deviceId, emp.employeeNo].filter(Boolean) as string[]))
  if (codes.length === 0) {
    return {
      employeeNo: emp.employeeNo,
      name,
      mode: "skipped",
      from: null,
      to: null,
      synced: 0,
      error: "No biometric code (device ID / employee code) set",
    }
  }
  const codeSet = new Set(codes)
  const today = istTodayStr()

  // First-ever sync (no rows yet) always does a full backfill.
  const hasData = await db.attendanceLog.findFirst({
    where: { employeeId: emp.id },
    select: { id: true },
  })
  const doFull = !!opts.full || !hasData

  // Earliest IST day we'll ever ask the device for (its retention window).
  const retentionFloor = istDayStr(new Date(Date.now() - MAX_BACKFILL_DAYS * 86_400_000))

  // Decide how far back to walk:
  //  - full backfill → down to the joining date (capped at retention).
  //  - incremental   → down to the last successful sync day (`opts.since`) so any
  //    days missed since the last sync are recovered, not just today + yesterday.
  //    Defaults to yesterday when the last-sync date is unknown.
  let floor: string
  if (doFull) {
    const joinDay = emp.dateOfJoining ? istDayStr(emp.dateOfJoining) : null
    floor = joinDay && joinDay > retentionFloor ? joinDay : retentionFloor
  } else {
    const since = opts.since ?? addDaysStr(today, -1)
    floor = since < retentionFloor ? retentionFloor : since > today ? today : since
  }

  // Walk backward from today to the floor in 15-day windows (most-recent first),
  // so the latest days are always captured even if an older window fails.
  let synced = 0
  const errors: string[] = []
  let batchEnd = today
  let earliest = today

  while (batchEnd >= floor) {
    const batchStart =
      addDaysStr(batchEnd, -(BATCH_DAYS - 1)) < floor
        ? floor
        : addDaysStr(batchEnd, -(BATCH_DAYS - 1))
    earliest = batchStart
    const res = await syncRange(emp, deviceId, config, codes, codeSet, batchStart, batchEnd)
    synced += res.synced
    if (res.error) {
      // Stop walking further back so an older flaky window can't block the rest.
      errors.push(`${batchStart}..${batchEnd}: ${res.error}`)
      break
    }
    batchEnd = addDaysStr(batchStart, -1)
  }

  return {
    employeeNo: emp.employeeNo,
    name,
    mode: doFull ? "full" : "incremental",
    from: earliest,
    to: today,
    synced,
    error: errors.length ? errors.join("; ") : undefined,
  }
}

/**
 * Smart sync for one device: probe connectivity once, then for every active
 * employee (excluding the hidden watch account) pull either their full history
 * (never synced / `full`) or just today + yesterday. Pass `onlyEmployeeNo` to
 * target one person. Throws DeviceUnreachableError when the device can't be reached.
 */
export async function syncDeviceSmart(
  deviceId: string,
  config: DeviceConfig,
  opts: { onlyEmployeeNo?: string; full?: boolean } = {},
): Promise<{ totalSynced: number; results: EmployeeSyncResult[] }> {
  const probe = await testDeviceConnection(config)
  if (!probe.success) throw new DeviceUnreachableError(probe.message)

  // Incremental syncs backfill from the device's last successful sync day (so any
  // days missed between syncs are recovered), not just today + yesterday. `full`
  // ignores this and re-backfills from each employee's joining date.
  const device = await db.hikvisionDevice.findUnique({
    where: { id: deviceId },
    select: { lastSyncAt: true },
  })
  const since = device?.lastSyncAt ? istDayStr(device.lastSyncAt) : undefined

  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      // Never sync the silent admin_ watch account.
      NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
      ...(opts.onlyEmployeeNo
        ? { OR: [{ employeeNo: opts.onlyEmployeeNo }, { deviceId: opts.onlyEmployeeNo }] }
        : {}),
    },
    select: {
      id: true,
      employeeNo: true,
      deviceId: true,
      firstName: true,
      lastName: true,
      dateOfJoining: true,
    },
  })

  const results: EmployeeSyncResult[] = []
  let totalSynced = 0
  for (const emp of employees) {
    const r = await syncEmployeeAttendance(deviceId, config, emp, { full: opts.full, since })
    results.push(r)
    totalSynced += r.synced
  }

  return { totalSynced, results }
}
