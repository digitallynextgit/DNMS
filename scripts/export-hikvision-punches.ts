import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import {
  fetchAttendanceEvents,
  testDeviceConnection,
  type HikvisionDeviceConfig,
} from "../features/attendance/server/hikvision"
import { HIDDEN_ROLES } from "../lib/constants"

// ─── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_FROM = "2026-01-01"
// Each device query spans this many days, ALL employees at once (no per-person
// filter - see the query loop below for why). Kept deliberately short so one
// call's event count stays well under fetchAttendanceEvents' own ~1500-event
// pagination ceiling (50 pages x ~30/page) even on a bad day: at a generous
// 20 punches/employee/day and ~25 employees, 2 days = 1000 events, a
// comfortable margin. fetchAttendanceEvents returns no error when it silently
// truncates at that ceiling, so headroom here is the only real guard - if the
// team roughly doubles in size, shrink this further via WARN_EVENT_THRESHOLD's
// warning as a signal.
const BATCH_DAYS = 2
// If a single window+device call returns at least this many raw events, log a
// loud warning - it's a sign BATCH_DAYS is getting close to the pagination
// ceiling and should be lowered before results silently go missing.
const WARN_EVENT_THRESHOLD = 1000
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

// ─── IST date/time helpers (mirrors features/attendance/server/sync.ts) ─────
// The device clock is IST, so punches must be bucketed/rendered in IST, not
// UTC-shifted, or a punch near midnight lands on the wrong calendar day.

function istDayStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}
function istTimeStr(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 19)
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
function enumerateDays(fromDay: string, toDay: string): string[] {
  const days: string[] = []
  for (let d = fromDay; d <= toDay; d = addDaysStr(d, 1)) days.push(d)
  return days
}

// ─── CLI args ───────────────────────────────────────────────────────────────

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function argValue(flag: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1]
}
function parseDayArg(flag: string, fallback: string): string {
  const raw = argValue(flag)
  if (raw === undefined) return fallback
  if (!DAY_RE.test(raw)) throw new Error(`--${flag}=${raw} is not a valid YYYY-MM-DD date`)
  return raw
}

const FROM_DAY = parseDayArg("from", DEFAULT_FROM)
const TO_DAY = parseDayArg("to", istTodayStr())

// ─── CSV helpers ────────────────────────────────────────────────────────────
// Standard RFC4180-style escaping: quote a field only when it contains the
// delimiter, a quote, or a newline; double up embedded quotes.

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
function csvRow(cells: string[]): string {
  return cells.map(csvEscape).join(",")
}

// ─── DB (same driver-adapter setup as prisma/seed.ts - a single, non-idle
// connection so a self-hosted Postgres session isn't dropped mid-run) ────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  keepAlive: true,
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

type Employee = {
  id: string
  employeeNo: string
  deviceId: string | null
  firstName: string | null
  lastName: string | null
  dateOfJoining: Date | null
  lastWorkingDate: Date | null
  resignationDate: Date | null
}

/** [dateOfJoining, lastWorkingDate ?? resignationDate] as IST day strings, either end open (null) if unset. */
function employmentRange(emp: Employee): { start: string | null; end: string | null } {
  return {
    start: emp.dateOfJoining ? istDayStr(emp.dateOfJoining) : null,
    end: emp.lastWorkingDate
      ? istDayStr(emp.lastWorkingDate)
      : emp.resignationDate
        ? istDayStr(emp.resignationDate)
        : null,
  }
}
function inRange(range: { start: string | null; end: string | null }, day: string): boolean {
  if (range.start && day < range.start) return false
  if (range.end && day > range.end) return false
  return true
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (TO_DAY < FROM_DAY) throw new Error(`--to (${TO_DAY}) is before --from (${FROM_DAY})`)

  console.log("Exporting Hikvision punch-in history")
  console.log(`Range: ${FROM_DAY} .. ${TO_DAY} (IST, inclusive)`)
  console.log("NOTE: this talks directly to the Hikvision device(s) on the local")
  console.log("network - run it from the office LAN, not remotely.")
  console.log("─────────────────────────────────────────")

  const devices = await prisma.hikvisionDevice.findMany({ where: { isActive: true } })
  if (devices.length === 0) {
    console.error("No active Hikvision devices configured (hikvision_devices table is empty).")
    process.exit(1)
  }
  console.log(`Devices: ${devices.map((d) => `${d.name} (${d.ipAddress}:${d.port})`).join(", ")}`)

  // Every employee, including inactive/resigned ones (so historical punches
  // for anyone who left mid-range still show up) - excluding only the hidden
  // admin_ watch account, same as the rest of the app never surfaces it.
  const employees: Employee[] = await prisma.employee.findMany({
    where: {
      NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
    },
    select: {
      id: true,
      employeeNo: true,
      deviceId: true,
      firstName: true,
      lastName: true,
      dateOfJoining: true,
      lastWorkingDate: true,
      resignationDate: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })
  console.log(`Employees: ${employees.length} (excluding hidden accounts)`)

  // A punch's employeeNoString on the device can match either the HR employee
  // code or the biometric deviceId - same dual-code approach as
  // features/attendance/server/sync.ts. Unlike sync.ts (which only ever looks
  // at ONE currently-active employee's own codes), this script deliberately
  // includes past employees too, so a code can legitimately have more than one
  // historical holder - keep every candidate, not just the last one seen.
  const codeToCandidates = new Map<string, Employee[]>()
  function addCode(code: string | null, emp: Employee) {
    if (!code) return
    const arr = codeToCandidates.get(code)
    if (!arr) {
      codeToCandidates.set(code, [emp])
      return
    }
    // An employee whose employeeNo equals their own deviceId (common - both
    // fields often hold the same HR code) would otherwise get pushed twice
    // for the same code, making a single person look like "2 holders".
    if (!arr.some((e) => e.id === emp.id)) arr.push(emp)
  }
  for (const emp of employees) {
    addCode(emp.employeeNo, emp)
    addCode(emp.deviceId, emp)
  }
  const sharedCodes = [...codeToCandidates.entries()].filter(([, holders]) => holders.length > 1)

  let unresolvedPunches = 0
  /** Resolve which employee a device code's punch belongs to on a given IST day. */
  function resolveEmployeeForPunch(code: string, day: string): Employee | null {
    const candidates = codeToCandidates.get(code)
    if (!candidates || candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]
    const inWindow = candidates.filter((c) => inRange(employmentRange(c), day))
    if (inWindow.length === 1) return inWindow[0]
    if (inWindow.length > 1) {
      // Overlapping/incomplete employment dates for a shared code - can't
      // disambiguate cleanly, so prefer whoever joined most recently as of
      // this day (the most likely current holder).
      return [...inWindow].sort(
        (a, b) => (b.dateOfJoining?.getTime() ?? 0) - (a.dateOfJoining?.getTime() ?? 0),
      )[0]
    }
    // Nobody's recorded employment window covers this day - don't guess.
    unresolvedPunches++
    return null
  }

  const windows: Array<{ start: string; end: string }> = []
  for (let start = FROM_DAY; start <= TO_DAY; ) {
    const end =
      addDaysStr(start, BATCH_DAYS - 1) > TO_DAY ? TO_DAY : addDaysStr(start, BATCH_DAYS - 1)
    windows.push({ start, end })
    start = addDaysStr(end, 1)
  }
  console.log(`Querying ${windows.length} window(s) x ${devices.length} device(s)...`)
  console.log("")

  // employeeId -> "YYYY-MM-DD" -> punch Date[]
  const punchesByEmployee = new Map<string, Map<string, Date[]>>()
  const seenPunch = new Set<string>() // `${employeeId}|${epochMs}` - dedupe across devices/windows
  const deviceErrors: string[] = []
  let totalMatched = 0

  let callIndex = 0
  const totalCalls = windows.length * devices.length
  for (const device of devices) {
    const config: HikvisionDeviceConfig = {
      ipAddress: device.ipAddress,
      port: device.port,
      username: device.username,
      password: device.password,
    }

    // Fail fast: one ~8s probe instead of discovering unreachability only
    // after every window for this device times out individually (each event
    // query gets up to 20s - with dozens of windows that's many minutes of
    // waiting to learn what one probe tells us immediately).
    process.stdout.write(`Probing ${device.name} (${device.ipAddress}:${device.port}) ... `)
    const probe = await testDeviceConnection(config)
    if (!probe.success) {
      console.log(`UNREACHABLE - ${probe.message}`)
      callIndex += windows.length
      for (const win of windows) {
        deviceErrors.push(
          `${device.name} ${win.start}..${win.end}: ${probe.message} (device unreachable)`,
        )
      }
      continue
    }
    console.log("OK")

    for (const win of windows) {
      callIndex++
      process.stdout.write(
        `  [${callIndex}/${totalCalls}] ${device.name} ${win.start}..${win.end} ... `,
      )

      // major=5 (access control), minor=0 (all sub-types) - every punch, any
      // auth method (face/card/fingerprint). No employeeNoString filter: pull
      // everyone in the window in one call and match client-side, since some
      // firmware ignores the server-side person filter anyway (see
      // fetchAttendanceEvents' own comment).
      const { events, error } = await fetchAttendanceEvents(
        config,
        istDayStartUtc(win.start),
        istDayEndUtc(win.end),
        5,
        0,
      )

      if (error) {
        deviceErrors.push(`${device.name} ${win.start}..${win.end}: ${error}`)
        console.log(`ERROR - ${error}`)
        continue
      }
      if (events.length >= WARN_EVENT_THRESHOLD) {
        console.log("")
        console.log(
          `  WARNING: ${events.length} events in one call (>= ${WARN_EVENT_THRESHOLD}) - ` +
            `close to the device's pagination ceiling. Results for this window may be ` +
            `incomplete; consider lowering BATCH_DAYS and re-running.`,
        )
      }

      let matchedThisCall = 0
      for (const ev of events) {
        const day = istDayStr(ev.timestamp)
        if (day < FROM_DAY || day > TO_DAY) continue // window edges can spill a few hours over

        const emp = resolveEmployeeForPunch(ev.employeeNo, day)
        if (!emp) continue

        const dedupeKey = `${emp.id}|${ev.timestamp.getTime()}`
        if (seenPunch.has(dedupeKey)) continue
        seenPunch.add(dedupeKey)

        let byDay = punchesByEmployee.get(emp.id)
        if (!byDay) {
          byDay = new Map()
          punchesByEmployee.set(emp.id, byDay)
        }
        const arr = byDay.get(day)
        if (arr) arr.push(ev.timestamp)
        else byDay.set(day, [ev.timestamp])
        matchedThisCall++
      }
      totalMatched += matchedThisCall
      console.log(`${events.length} events, ${matchedThisCall} matched to an employee`)
    }
  }

  if (deviceErrors.length === totalCalls) {
    throw new Error(
      `All ${totalCalls} device call(s) failed - no data was retrieved. Not writing a CSV. ` +
        `First error: ${deviceErrors[0]}`,
    )
  }

  // ─── Build CSV ──────────────────────────────────────────────────────────
  const allDays = enumerateDays(FROM_DAY, TO_DAY)
  const rows: string[] = [csvRow(["Sno", "Employee Name", ...allDays])]

  let sno = 0
  for (const emp of employees) {
    sno++
    const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ")
    const byDay = punchesByEmployee.get(emp.id)
    const dayCells = allDays.map((day) => {
      const punches = byDay?.get(day)
      if (!punches || punches.length === 0) return ""
      punches.sort((a, b) => a.getTime() - b.getTime())
      return punches.map(istTimeStr).join("; ")
    })
    rows.push(csvRow([String(sno), name, ...dayCells]))
  }

  const outDir = path.join("scripts", "output")
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `employee-punch-ins_${FROM_DAY}_to_${TO_DAY}.csv`)
  // UTF-8 BOM so Excel on Windows renders non-ASCII names correctly; CRLF line
  // endings to match the RFC4180 convention Excel expects.
  writeFileSync(outPath, "﻿" + rows.join("\r\n"), "utf8")

  console.log("")
  console.log("─────────────────────────────────────────")
  console.log(
    `Wrote ${employees.length} employees x ${allDays.length} days (${totalMatched} punches) to:`,
  )
  console.log(`  ${outPath}`)

  if (sharedCodes.length) {
    console.log("")
    console.log(
      `NOTE: ${sharedCodes.length} device code(s) have been held by more than one employee ` +
        `over time (reused biometric/employee codes). Punches were attributed by employment ` +
        `dates; verify these rows if anything looks off:`,
    )
    for (const [code, holders] of sharedCodes) {
      console.log(
        `  - code "${code}": ${holders.map((h) => `${h.firstName} ${h.lastName}`).join(", ")}`,
      )
    }
  }
  if (unresolvedPunches > 0) {
    console.log("")
    console.log(
      `NOTE: ${unresolvedPunches} punch(es) used a shared code but fell outside every ` +
        `candidate's recorded employment window, so they were dropped rather than guessed.`,
    )
  }

  if (deviceErrors.length) {
    console.log("")
    console.log(
      `WARNING: ${deviceErrors.length}/${totalCalls} window(s) failed - the CSV is missing data:`,
    )
    for (const e of deviceErrors) console.log(`  - ${e}`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error("Export failed:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
