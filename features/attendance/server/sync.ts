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
// Long backfills are split into sub-ranges so one request never blows past the
// device's per-query page cap (~2500 events) or its socket timeout.
const CHUNK_DAYS = 31

function utcMidnight(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function todayUtc(): Date {
  return utcMidnight(new Date())
}

export interface EmployeeSyncResult {
  employeeNo: string
  name?: string
  /** "full" = whole history backfilled, "incremental" = last day → today, "skipped" = no code. */
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

/** Split [start, end] into ≤ CHUNK_DAYS UTC day-aligned sub-ranges. */
function dateChunks(start: Date, end: Date): Array<[Date, Date]> {
  const chunks: Array<[Date, Date]> = []
  let cur = utcMidnight(start)
  const last = utcMidnight(end)
  while (cur <= last) {
    const chunkEnd = new Date(cur)
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + CHUNK_DAYS - 1)
    const realEnd = chunkEnd > last ? last : chunkEnd
    const s = utcMidnight(cur)
    const e = new Date(realEnd)
    e.setUTCHours(23, 59, 59, 999)
    chunks.push([s, e])
    cur = new Date(realEnd)
    cur.setUTCDate(cur.getUTCDate() + 1)
    cur.setUTCHours(0, 0, 0, 0)
  }
  return chunks
}

/**
 * First day to (re-)pull for one employee:
 *  - existing data → their last recorded day (re-pulls it to catch a check-out
 *    that landed after the previous sync, plus everything since). [incremental]
 *  - no data, or `forceFull` → from their joining date, capped at the device's
 *    retention window. [full]
 */
async function resolveStart(
  emp: SyncEmployee,
  forceFull: boolean,
): Promise<{ start: Date; mode: "full" | "incremental" }> {
  const floor = todayUtc()
  floor.setUTCDate(floor.getUTCDate() - MAX_BACKFILL_DAYS)
  const fullStart = () => {
    const join = emp.dateOfJoining ? utcMidnight(emp.dateOfJoining) : null
    return join && join > floor ? join : floor
  }

  if (forceFull) return { start: fullStart(), mode: "full" }

  const last = await db.attendanceLog.findFirst({
    where: { employeeId: emp.id },
    orderBy: { date: "desc" },
    select: { date: true },
  })
  if (last) return { start: utcMidnight(last.date), mode: "incremental" }
  return { start: fullStart(), mode: "full" }
}

/** Upsert one attendance row for an employee+day from that day's punches. */
async function upsertDay(
  employeeId: string,
  deviceId: string,
  dateStr: string,
  punches: Date[],
): Promise<void> {
  const date = new Date(`${dateStr}T00:00:00.000Z`)
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
}

/**
 * Pull ONE employee's punches from a device and upsert one row per day they
 * punched. Matches the device's `employeeNoString` against the employee's device
 * id AND HR code, and filters client-side too, so it's correct whether or not the
 * device honors the server-side person filter. Weekends/holidays/absences are not
 * written - only real punch days. Assumes connectivity was already probed.
 */
export async function syncEmployeeAttendance(
  deviceId: string,
  config: DeviceConfig,
  emp: SyncEmployee,
  opts: { full?: boolean } = {},
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

  const { start, mode } = await resolveStart(emp, !!opts.full)
  const end = todayUtc()
  end.setUTCHours(23, 59, 59, 999)
  const codeSet = new Set(codes)

  // Collect punches grouped by day, deduped by (code, timestamp) across the
  // employee's code(s) and the monthly chunks.
  const punchesByDay = new Map<string, Date[]>()
  const seen = new Set<string>()
  const errors: string[] = []

  for (const [chunkStart, chunkEnd] of dateChunks(start, end)) {
    for (const code of codes) {
      // major=5, minor=75 → person access-grants (the real punches) only.
      const { events, error } = await fetchAttendanceEvents(
        config,
        chunkStart,
        chunkEnd,
        5,
        75,
        code,
      )
      if (error) errors.push(error)
      for (const ev of events) {
        if (!codeSet.has(ev.employeeNo)) continue
        const dedupeKey = `${ev.employeeNo}|${ev.timestamp.getTime()}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        const day = ev.timestamp.toISOString().slice(0, 10)
        const arr = punchesByDay.get(day)
        if (arr) arr.push(ev.timestamp)
        else punchesByDay.set(day, [ev.timestamp])
      }
    }
  }

  let synced = 0
  for (const [day, punches] of punchesByDay) {
    try {
      await upsertDay(emp.id, deviceId, day, punches)
      synced++
    } catch (e) {
      errors.push(`${day}: ${String(e)}`)
    }
  }

  return {
    employeeNo: emp.employeeNo,
    name,
    mode,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    synced,
    error: errors.length ? errors.join("; ") : undefined,
  }
}

/**
 * Smart sync for one device: probe connectivity once, then for every active
 * employee (excluding the hidden watch account) pull either their full history
 * (never synced) or just last-recorded-day → today. Pass `onlyEmployeeNo` to
 * target one person and `full` to force a complete re-backfill.
 * Throws DeviceUnreachableError when the device can't be reached.
 */
export async function syncDeviceSmart(
  deviceId: string,
  config: DeviceConfig,
  opts: { onlyEmployeeNo?: string; full?: boolean } = {},
): Promise<{ totalSynced: number; results: EmployeeSyncResult[] }> {
  const probe = await testDeviceConnection(config)
  if (!probe.success) throw new DeviceUnreachableError(probe.message)

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
    const r = await syncEmployeeAttendance(deviceId, config, emp, { full: opts.full })
    results.push(r)
    totalSynced += r.synced
  }

  return { totalSynced, results }
}
