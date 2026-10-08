import "server-only"

import type { AttendanceStatus } from "@prisma/client"
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

// Backfill cap for never-synced employees (the device only keeps a finite event buffer).
const MAX_BACKFILL_DAYS = 730
// History is fetched in short all-employee windows: some firmware ignores the person filter and
// fetchAttendanceEvents caps at ~1500 events, so wide queries drop the newest punches.
const BATCH_DAYS = 2
// Incremental syncs re-read the last week so days synced before everyone punched out settle
// to the real first/last punch (manual corrections are never overwritten).
const INCREMENTAL_LOOKBACK_DAYS = 7
// Warn when one window nears the pagination ceiling (lower BATCH_DAYS if this fires).
const WARN_EVENT_THRESHOLD = 1000
// The device clock is IST; days and times are stored in IST.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

export interface EmployeeSyncResult {
  employeeNo: string
  name?: string
  /** "incremental" = from the last sync day to today; "skipped" = no biometric code. */
  mode: "full" | "incremental" | "skipped"
  from: string | null
  to: string | null
  synced: number
  error?: string
}

/** Emitted after each device window so the UI can draw a real progress bar + ETA. */
export interface SyncProgress {
  phase: "probing" | "fetching" | "writing" | "done"
  windowsDone: number
  windowsTotal: number
  /** The IST day range just fetched, e.g. "2026-07-13..2026-07-14". */
  currentRange?: string
  punches: number
  elapsedMs: number
  etaMs: number | null
  message?: string
}

interface SyncEmployee {
  id: string
  employeeNo: string
  deviceId: string | null
  firstName?: string | null
  lastName?: string | null
  dateOfJoining?: Date | null
  /** Used to decide "was this person already covered by a previous device sync?" */
  createdAt: Date
}

// IST "YYYY-MM-DD" day strings, so a punch lands on the day it was made (the device is IST).

function istDayStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}
function istTodayStr(): string {
  return istDayStr(new Date())
}
function istDayStartUtc(dayStr: string): Date {
  return new Date(`${dayStr}T00:00:00.000+05:30`)
}
function istDayEndUtc(dayStr: string): Date {
  return new Date(`${dayStr}T23:59:59.999+05:30`)
}
function addDaysStr(dayStr: string, n: number): string {
  const d = new Date(`${dayStr}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Whole days from `from` to `to` (both YYYY-MM-DD, inclusive of neither end). */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime()
  const b = new Date(`${to}T00:00:00.000Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** An existing row's per-field manual locks + the values HR pinned. */
export interface ManualDayLocks {
  checkIn: Date | null
  checkOut: Date | null
  status: AttendanceStatus
  checkInManual: boolean
  checkOutManual: boolean
  statusManual: boolean
}

/** Upsert one IST day from its punches (first = check-in, last = check-out). HR corrections
 *  are pinned per field, the rest follows the device; a fully pinned day is skipped. */
async function upsertDay(
  employeeId: string,
  deviceId: string,
  istDay: string,
  punches: Date[],
  manualByDay: ReadonlyMap<string, ManualDayLocks>,
): Promise<"written" | "skipped"> {
  const date = new Date(`${istDay}T00:00:00.000Z`)

  const locks = manualByDay.get(istDay)
  // Nothing the device can contribute - every field is pinned by HR.
  if (locks?.checkInManual && locks.checkOutManual && locks.statusManual) return "skipped"

  punches.sort((a, b) => a.getTime() - b.getTime())
  const deviceIn: Date | null = punches[0] ?? null
  const deviceOut: Date | null = punches.length > 1 ? punches[punches.length - 1]! : null

  const checkIn = locks?.checkInManual ? locks.checkIn : deviceIn
  const checkOut = locks?.checkOutManual ? locks.checkOut : deviceOut

  let workHours: number | null = null
  if (checkIn && checkOut && checkOut > checkIn) {
    workHours =
      Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
  }
  const status = locks?.statusManual
    ? locks.status
    : computeAttendanceStatus({ checkIn, workHours })

  // A partially corrected row keeps its "manual" provenance.
  const hasManual = !!(locks?.checkInManual || locks?.checkOutManual || locks?.statusManual)

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
      ...(hasManual ? {} : { source: "device", notes: "Synced from device" }),
    },
  })
  return "written"
}

/**
 * Sync one device: walk the date span in short windows, fetching all employees' punches per call
 * and matching them by device code. Full backfill starts at the joining date (capped); incremental
 * re-reads INCREMENTAL_LOOKBACK_DAYS before the last sync. Throws DeviceUnreachableError.
 */
export async function syncDeviceSmart(
  deviceId: string,
  config: DeviceConfig,
  opts: {
    onlyEmployeeNo?: string
    full?: boolean
    onProgress?: (p: SyncProgress) => void
  } = {},
): Promise<{ totalSynced: number; results: EmployeeSyncResult[]; completed: boolean }> {
  const startedAt = Date.now()
  const report = (p: Omit<SyncProgress, "elapsedMs">) =>
    opts.onProgress?.({ ...p, elapsedMs: Date.now() - startedAt })

  report({ phase: "probing", windowsDone: 0, windowsTotal: 0, punches: 0, etaMs: null })
  const probe = await testDeviceConnection(config)
  if (!probe.success) throw new DeviceUnreachableError(probe.message)

  const today = istTodayStr()
  const retentionFloor = istDayStr(new Date(Date.now() - MAX_BACKFILL_DAYS * 86_400_000))

  const device = await db.hikvisionDevice.findUnique({
    where: { id: deviceId },
    select: { lastSyncAt: true },
  })
  const since = device?.lastSyncAt ? istDayStr(device.lastSyncAt) : undefined

  const employees: SyncEmployee[] = await db.employee.findMany({
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
      createdAt: true,
    },
  })

  const acc = new Map<
    string,
    {
      emp: SyncEmployee
      floor: string | null // earliest IST day to WRITE for this person (null = skipped)
      doFull: boolean
      punchesByDay: Map<string, Date[]>
      seen: Set<number> // punch epochMs already recorded (dedupe across windows)
    }
  >()

  // Map both codes (employeeNo and deviceId) to employees; a code reused over time is
  // disambiguated by joining date.
  const codeToCandidates = new Map<string, SyncEmployee[]>()
  function addCode(code: string | null, emp: SyncEmployee) {
    if (!code) return
    const arr = codeToCandidates.get(code)
    if (!arr) codeToCandidates.set(code, [emp])
    else if (!arr.some((e) => e.id === emp.id)) arr.push(emp)
  }

  for (const emp of employees) {
    const codes = [emp.deviceId, emp.employeeNo].filter(Boolean) as string[]
    if (codes.length === 0) {
      acc.set(emp.id, {
        emp,
        floor: null,
        doFull: false,
        punchesByDay: new Map(),
        seen: new Set(),
      })
      continue
    }
    for (const c of codes) addCode(c, emp)

    // Full backfill only for employees created after the last sync - NOT "has no rows": someone
    // not on the device never gets rows and would force a multi-year crawl on every sync.
    // Re-backfill an existing employee with the per-row "Full" button (?full=1).
    const isNewSinceLastSync = !device?.lastSyncAt || emp.createdAt > device.lastSyncAt
    const doFull = !!opts.full || isNewSinceLastSync

    let floor: string
    if (doFull) {
      const joinDay = emp.dateOfJoining ? istDayStr(emp.dateOfJoining) : null
      floor = joinDay && joinDay > retentionFloor ? joinDay : retentionFloor
    } else {
      const s = addDaysStr(since ?? today, -INCREMENTAL_LOOKBACK_DAYS)
      floor = s < retentionFloor ? retentionFloor : s > today ? today : s
    }
    acc.set(emp.id, { emp, floor, doFull, punchesByDay: new Map(), seen: new Set() })
  }

  function resolveEmployee(code: string, day: string): SyncEmployee | null {
    const cands = codeToCandidates.get(code)
    if (!cands || cands.length === 0) return null
    if (cands.length === 1) return cands[0]
    // Prefer candidates already employed as of this day, most recent joiner first.
    const employed = cands.filter((c) => !c.dateOfJoining || istDayStr(c.dateOfJoining) <= day)
    const pool = employed.length ? employed : cands
    return [...pool].sort(
      (a, b) => (b.dateOfJoining?.getTime() ?? 0) - (a.dateOfJoining?.getTime() ?? 0),
    )[0]
  }

  const floors = [...acc.values()].map((a) => a.floor).filter((f): f is string => f !== null)
  const globalFloor = floors.length ? floors.reduce((a, b) => (a < b ? a : b)) : today

  // Walk back from today in short windows, newest first, so recent days survive an older failure.
  const deviceErrors: string[] = []
  let consecutiveFailures = 0
  let batchEnd = today
  const windowsTotal = Math.max(1, Math.ceil((daysBetween(globalFloor, today) + 1) / BATCH_DAYS))
  let windowsDone = 0
  let punches = 0
  let bailed = false
  while (batchEnd >= globalFloor) {
    const batchStart =
      addDaysStr(batchEnd, -(BATCH_DAYS - 1)) < globalFloor
        ? globalFloor
        : addDaysStr(batchEnd, -(BATCH_DAYS - 1))

    // major=5 (access control), minor=0 (all auth methods); no person filter, matched client-side.
    // Retried because the device can drop the odd request mid-run.
    let events: Awaited<ReturnType<typeof fetchAttendanceEvents>>["events"] = []
    let error: string | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetchAttendanceEvents(
        config,
        istDayStartUtc(batchStart),
        istDayEndUtc(batchEnd),
        5,
        0,
      )
      if (!res.error) {
        events = res.events
        error = undefined
        break
      }
      error = res.error
    }
    if (error) {
      // Record a flaky window and keep walking back; bail only after several failures in a row.
      deviceErrors.push(`${batchStart}..${batchEnd}: ${error}`)
      if (++consecutiveFailures >= 3) {
        bailed = true
        break
      }
      batchEnd = addDaysStr(batchStart, -1)
      continue
    }
    consecutiveFailures = 0
    if (events.length >= WARN_EVENT_THRESHOLD) {
      console.warn(
        `[attendance sync] ${events.length} events in one window (${batchStart}..${batchEnd}) - ` +
          `close to the pagination ceiling; consider lowering BATCH_DAYS.`,
      )
    }

    for (const ev of events) {
      const day = istDayStr(ev.timestamp)
      if (day < globalFloor || day > today) continue // window edges can spill a few hours
      const emp = resolveEmployee(ev.employeeNo, day)
      if (!emp) continue
      const bucket = acc.get(emp.id)
      if (!bucket || bucket.floor === null) continue
      if (day < bucket.floor) continue // respect this person's own incremental floor
      const ms = ev.timestamp.getTime()
      if (bucket.seen.has(ms)) continue
      bucket.seen.add(ms)
      punches++
      const arr = bucket.punchesByDay.get(day)
      if (arr) arr.push(ev.timestamp)
      else bucket.punchesByDay.set(day, [ev.timestamp])
    }

    windowsDone++
    const avgMs = (Date.now() - startedAt) / windowsDone
    report({
      phase: "fetching",
      windowsDone,
      windowsTotal,
      currentRange: `${batchStart}..${batchEnd}`,
      punches,
      etaMs: Math.max(0, Math.round(avgMs * (windowsTotal - windowsDone))),
    })

    batchEnd = addDaysStr(batchStart, -1)
  }

  report({
    phase: "writing",
    windowsDone,
    windowsTotal,
    punches,
    etaMs: 0,
    message: "Writing attendance…",
  })

  const sharedError = deviceErrors.length ? deviceErrors.join("; ") : undefined
  const results: EmployeeSyncResult[] = []
  let totalSynced = 0

  for (const { emp, floor, doFull, punchesByDay } of acc.values()) {
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || undefined
    if (floor === null) {
      results.push({
        employeeNo: emp.employeeNo,
        name,
        mode: "skipped",
        from: null,
        to: null,
        synced: 0,
        error: "No biometric code (device ID / employee code) set",
      })
      continue
    }

    const writeErrors: string[] = []
    let synced = 0

    // One query for all manual corrections in this employee's range (per-field locks + values).
    const dayKeys = [...punchesByDay.keys()]
    const manualRows = await db.attendanceLog.findMany({
      where: {
        employeeId: emp.id,
        OR: [{ checkInManual: true }, { checkOutManual: true }, { statusManual: true }],
        date: { in: dayKeys.map((d) => new Date(`${d}T00:00:00.000Z`)) },
      },
      select: {
        date: true,
        checkIn: true,
        checkOut: true,
        status: true,
        checkInManual: true,
        checkOutManual: true,
        statusManual: true,
      },
    })
    const manualByDay = new Map<string, ManualDayLocks>(
      manualRows.map((r) => [r.date.toISOString().slice(0, 10), r]),
    )

    // Bounded write concurrency, kept at/below the pg pool size.
    const WRITE_CHUNK = 10
    const entries = [...punchesByDay.entries()]
    for (let i = 0; i < entries.length; i += WRITE_CHUNK) {
      const slice = entries.slice(i, i + WRITE_CHUNK)
      const settled = await Promise.allSettled(
        slice.map(([day, punches]) => upsertDay(emp.id, deviceId, day, punches, manualByDay)),
      )
      settled.forEach((res, j) => {
        if (res.status === "fulfilled") {
          if (res.value === "written") synced++
        } else {
          writeErrors.push(`${slice[j]![0]}: ${String(res.reason)}`)
        }
      })
    }
    totalSynced += synced

    const err = [sharedError, writeErrors.join("; ")].filter(Boolean).join("; ") || undefined
    results.push({
      employeeNo: emp.employeeNo,
      name,
      mode: doFull ? "full" : "incremental",
      from: floor,
      to: today,
      synced,
      error: err,
    })
  }

  report({
    phase: "done",
    windowsDone,
    windowsTotal,
    punches,
    etaMs: 0,
    message: `${totalSynced} day(s) written`,
  })

  // The caller advances lastSyncAt only when `completed`, so a run that bailed early doesn't
  // mark the unfetched windows as covered.
  return { totalSynced, results, completed: !bailed }
}

/**
 * Record one punch pushed by the device, via the same upsertDay() as the sync so both paths agree.
 * The day's existing device check-in/out are fed back in alongside the new punch.
 */
export async function recordPunch(
  employeeId: string,
  deviceId: string,
  punchAt: Date,
): Promise<{ day: string; result: "written" | "skipped" }> {
  const day = istDayStr(punchAt)
  const date = new Date(`${day}T00:00:00.000Z`)

  const existing = await db.attendanceLog.findUnique({
    where: { employeeId_date: { employeeId, date } },
    select: {
      date: true,
      checkIn: true,
      checkOut: true,
      status: true,
      checkInManual: true,
      checkOutManual: true,
      statusManual: true,
    },
  })

  // Only device-derived edges are replayed; pinned fields go in as locks to avoid double counting.
  const punches: Date[] = [punchAt]
  if (existing?.checkIn && !existing.checkInManual) punches.push(existing.checkIn)
  if (existing?.checkOut && !existing.checkOutManual) punches.push(existing.checkOut)

  const manualByDay = new Map<string, ManualDayLocks>()
  if (existing && (existing.checkInManual || existing.checkOutManual || existing.statusManual)) {
    manualByDay.set(day, existing)
  }

  const result = await upsertDay(employeeId, deviceId, day, punches, manualByDay)
  return { day, result }
}
