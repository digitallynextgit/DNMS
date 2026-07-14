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
// History is pulled in SHORT windows spanning ALL employees at once (no per-person
// device filter). Some Hikvision firmware ignores the server-side person filter,
// so a wide per-person query silently pulls everyone's events and truncates at
// fetchAttendanceEvents' ~1500-event pagination ceiling - dropping the newest
// punches (this is why individual employees got wrong/missing days). Keeping the
// window short keeps one call's event count well under that ceiling: at ~25
// employees x ~20 punches/day, 2 days ≈ 1000 events, a comfortable margin.
// (Mirrors scripts/export-hikvision-punches.ts, which fetches the same way.)
const BATCH_DAYS = 2
// If a single window returns at least this many raw events, warn loudly - a sign
// BATCH_DAYS is nearing the pagination ceiling and should be lowered before data
// silently goes missing.
const WARN_EVENT_THRESHOLD = 1000
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

/** Emitted after each device window so the UI can draw a real progress bar + ETA. */
export interface SyncProgress {
  phase: "probing" | "fetching" | "writing" | "done"
  /** Device windows completed / total. Known up front, so percent + ETA are real. */
  windowsDone: number
  windowsTotal: number
  /** The IST day range just fetched, e.g. "2026-07-13..2026-07-14". */
  currentRange?: string
  /** Punches attributed so far. */
  punches: number
  /** Milliseconds elapsed since the sync started. */
  elapsedMs: number
  /** Estimated milliseconds remaining, from the measured average window time. */
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
/** Whole days from `from` to `to` (both YYYY-MM-DD, inclusive of neither end). */
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00.000Z`).getTime()
  const b = new Date(`${to}T00:00:00.000Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
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
  manualDays: ReadonlySet<string>,
): Promise<"written" | "skipped"> {
  const date = new Date(`${istDay}T00:00:00.000Z`)

  // The caller fetches every manual day for this employee ONCE (see below), so this
  // no longer costs a findUnique per employee-day. A full 730-day backfill used to be
  // 2 queries x days x employees, all sequential.
  if (manualDays.has(istDay)) return "skipped" // don't clobber a manual correction

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
 * Smart sync for one device.
 *
 * Strategy (mirrors scripts/export-hikvision-punches.ts): probe once, then walk
 * the needed date span in SHORT windows, querying EVERY employee's punches in a
 * single device call per window (no per-person filter - the firmware ignores it)
 * and attributing each punch client-side by its device code. This avoids the
 * pagination-ceiling truncation that a wide per-person query hits, so nobody's
 * newest days go silently missing.
 *
 *  - Full backfill (`full`, or a never-synced employee): from the joining date
 *    (capped at the device's retention window).
 *  - Incremental (Refresh / Sync button, cron): from the device's last successful
 *    sync day, so any days missed between syncs are recovered - not just today.
 *
 * Days are grouped in IST; the day's first punch = check-in, last = check-out.
 * Manual corrections are preserved. Pass `onlyEmployeeNo` to target one person.
 * Throws DeviceUnreachableError when the device can't be reached.
 */
export async function syncDeviceSmart(
  deviceId: string,
  config: DeviceConfig,
  opts: {
    onlyEmployeeNo?: string
    full?: boolean
    /** Called after each device window; drives the UI progress bar + ETA. */
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

  // Incremental syncs backfill from the device's last successful sync day.
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

  // Per-employee accumulator (results + the punches attributed to them).
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

  // Map every device code (employeeNo AND deviceId) → candidate employees, so a
  // punch is matched no matter which code it carries. Codes can, in principle,
  // be held by more than one person over time; disambiguate by joining date.
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

    // Does this person need a FULL backfill?
    //
    // The test is "were they already covered by a previous device sync?", i.e. were
    // they created BEFORE the device's last sync. It is deliberately NOT "do they
    // have any attendance rows": an employee whose code isn't on the device (or who
    // simply never punched) has no rows and never will, so the row-based test kept
    // them flagged "never synced" FOREVER - and because the device walk spans back to
    // the oldest employee floor, ONE such person dragged every sync into a full
    // multi-year crawl (~460 device calls) even when everyone else needed one day.
    //
    // createdAt > lastSyncAt correctly catches the case that matters: an employee
    // added AFTER the last sync (even with a backdated joining date) still gets their
    // whole history pulled. An existing employee who genuinely needs a re-backfill can
    // be fixed with the per-row "Full" button (?full=1).
    const isNewSinceLastSync = !device?.lastSyncAt || emp.createdAt > device.lastSyncAt
    const doFull = !!opts.full || isNewSinceLastSync

    let floor: string
    if (doFull) {
      const joinDay = emp.dateOfJoining ? istDayStr(emp.dateOfJoining) : null
      floor = joinDay && joinDay > retentionFloor ? joinDay : retentionFloor
    } else {
      // Step one day BACK from the last sync so a punch that landed late (or a day
      // that was still incomplete when we last looked) is re-read and corrected.
      const s = addDaysStr(since ?? today, -1)
      floor = s < retentionFloor ? retentionFloor : s > today ? today : s
    }
    acc.set(emp.id, { emp, floor, doFull, punchesByDay: new Map(), seen: new Set() })
  }

  /** Resolve which employee a device code's punch belongs to on a given IST day. */
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

  // The whole span to query = earliest per-employee floor .. today. (Employees
  // with no code contribute no floor.)
  const floors = [...acc.values()].map((a) => a.floor).filter((f): f is string => f !== null)
  const globalFloor = floors.length ? floors.reduce((a, b) => (a < b ? a : b)) : today

  // Walk backward from today to globalFloor in short windows (most-recent first),
  // so the latest days are always captured even if an older window fails.
  const deviceErrors: string[] = []
  let consecutiveFailures = 0
  let batchEnd = today
  // Total windows is known before we start (the span is fixed), so the progress bar
  // is a real fraction and the ETA is measured, not guessed.
  const windowsTotal = Math.max(1, Math.ceil((daysBetween(globalFloor, today) + 1) / BATCH_DAYS))
  let windowsDone = 0
  let punches = 0
  let bailed = false
  while (batchEnd >= globalFloor) {
    const batchStart =
      addDaysStr(batchEnd, -(BATCH_DAYS - 1)) < globalFloor
        ? globalFloor
        : addDaysStr(batchEnd, -(BATCH_DAYS - 1))

    // major=5 (access control), minor=0 (all sub-types) so every punch is
    // captured regardless of auth method (face/card/fingerprint). No person
    // filter: pull everyone in the window and match client-side. Retry a couple
    // of times before giving up on the window - the device can drop the odd
    // request mid-run even though it's reachable.
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
      // Don't abandon everything older on a single flaky window - record it and
      // keep walking back (so e.g. a hiccup near April can't drop March). Only
      // bail once several windows in a row fail, i.e. the device really went down.
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

  // Upsert per employee/day and build results.
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

    // ONE query for every manual correction in this employee's punch range, instead
    // of a findUnique per day inside the loop.
    const dayKeys = [...punchesByDay.keys()]
    const manualRows = await db.attendanceLog.findMany({
      where: {
        employeeId: emp.id,
        isManual: true,
        date: { in: dayKeys.map((d) => new Date(`${d}T00:00:00.000Z`)) },
      },
      select: { date: true },
    })
    const manualDays = new Set(manualRows.map((r) => r.date.toISOString().slice(0, 10)))

    // Writes go out with bounded concurrency rather than strictly one-at-a-time.
    // The chunk stays at/below the pg pool size so we queue rather than thrash it.
    const WRITE_CHUNK = 10
    const entries = [...punchesByDay.entries()]
    for (let i = 0; i < entries.length; i += WRITE_CHUNK) {
      const slice = entries.slice(i, i + WRITE_CHUNK)
      const settled = await Promise.allSettled(
        slice.map(([day, punches]) => upsertDay(emp.id, deviceId, day, punches, manualDays)),
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

  // `completed` = the device walk finished the whole span. The caller only advances
  // the device's lastSyncAt when this is true - otherwise a run that bailed early
  // would mark employees as "covered" when their older windows never got fetched.
  return { totalSynced, results, completed: !bailed }
}
