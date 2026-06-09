import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { fetchAttendanceEvents } from "@/lib/hikvision"
import { computeAttendanceStatus } from "@/lib/attendance"
import { $Enums } from "@prisma/client"
import type { Session } from "next-auth"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function buildDatetime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date)
  d.setUTCHours(hours, minutes, 0, 0)
  return d
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UpsertPayload {
  employeeId: string
  deviceId: string
  date: Date
  checkIn: Date | null
  checkOut: Date | null
  workHours: number | null
  status: $Enums.AttendanceStatus
  isManual: boolean
  notes: string
}

// ─── Real device sync ─────────────────────────────────────────────────────────

async function syncFromDevice(
  deviceId: string,
  deviceConfig: { ipAddress: string; port: number; username: string; password: string },
  policyHour: number,
  policyMin: number,
  lateGraceMins: number,
  datesToSync: Date[],
): Promise<{ synced: number; errors: string[]; usedSimulation: false }> {
  // const lateThresholdMins = policyHour * 60 + policyMin + lateGraceMins // late-mark (DISABLED - do not delete)

  // Fetch events for the entire range in one batch
  const rangeStart = new Date(datesToSync[datesToSync.length - 1]) // oldest date
  rangeStart.setUTCHours(0, 0, 0, 0)
  const rangeEnd = new Date(datesToSync[0]) // newest date
  rangeEnd.setUTCHours(23, 59, 59, 999)

  const { events, error } = await fetchAttendanceEvents(deviceConfig, rangeStart, rangeEnd)

  if (error && events.length === 0) {
    throw new Error(error)
  }

  // Resolve employee IDs - Hikvision stores employee numbers (e.g. "EMP-001")
  const employees = await db.employee.findMany({
    where: { isActive: true, status: "ACTIVE" },
    select: { id: true, employeeNo: true, deviceId: true },
  })
  // Resolve a device person-ID to an employee via deviceId first, then the code.
  const employeeByNo = new Map<string, string>()
  for (const e of employees) {
    employeeByNo.set(e.employeeNo, e.id)
    if (e.deviceId) employeeByNo.set(e.deviceId, e.id)
  }

  // Group events by employee + date
  type DayKey = string // "employeeId|YYYY-MM-DD"
  const checkIns = new Map<DayKey, Date>()
  const checkOuts = new Map<DayKey, Date>()

  for (const ev of events) {
    const empId = employeeByNo.get(ev.employeeNo)
    if (!empId) continue

    const dateStr = ev.timestamp.toISOString().slice(0, 10)
    const key: DayKey = `${empId}|${dateStr}`

    if (ev.direction === "check-in") {
      const existing = checkIns.get(key)
      // Keep the earliest check-in
      if (!existing || ev.timestamp < existing) {
        checkIns.set(key, ev.timestamp)
      }
    } else if (ev.direction === "check-out") {
      const existing = checkOuts.get(key)
      // Keep the latest check-out
      if (!existing || ev.timestamp > existing) {
        checkOuts.set(key, ev.timestamp)
      }
    } else {
      // Unknown direction: treat first event as check-in, last as check-out
      const existing = checkIns.get(key)
      if (!existing) {
        checkIns.set(key, ev.timestamp)
      } else {
        const existingOut = checkOuts.get(key)
        if (!existingOut || ev.timestamp > existingOut) {
          checkOuts.set(key, ev.timestamp)
        }
      }
    }
  }

  let synced = 0
  const errors: string[] = []

  for (const date of datesToSync) {
    const dayOfWeek = date.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const dateStr = date.toISOString().slice(0, 10)

    for (const emp of employees) {
      const empId = emp.id
      const key: DayKey = `${empId}|${dateStr}`

      try {
        let payload: UpsertPayload

        if (isWeekend) {
          payload = {
            employeeId: empId,
            deviceId,
            date,
            checkIn: null,
            checkOut: null,
            workHours: null,
            status: $Enums.AttendanceStatus.WEEKEND,
            isManual: false,
            notes: "Weekend - synced from device",
          }
        } else {
          const checkIn = checkIns.get(key) ?? null
          const checkOut = checkOuts.get(key) ?? null

          let workHours: number | null = null
          if (checkIn && checkOut && checkOut > checkIn) {
            workHours =
              Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
          }

          // Derive status from hours worked (half-day / absent rules).
          const status = computeAttendanceStatus({ checkIn, workHours })

          // ── Late-mark logic (DISABLED for now - do not delete) ──────────────
          // Re-enable when late-mark policy (>9:45 grace, 3 marks/month) ships.
          // let status: $Enums.AttendanceStatus = $Enums.AttendanceStatus.ABSENT
          // if (checkIn) {
          //   const checkInMins = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes()
          //   status =
          //     checkInMins > lateThresholdMins
          //       ? $Enums.AttendanceStatus.LATE
          //       : $Enums.AttendanceStatus.PRESENT
          // }

          payload = {
            employeeId: empId,
            deviceId,
            date,
            checkIn,
            checkOut,
            workHours,
            status,
            isManual: false,
            notes: "Synced from Hikvision device",
          }
        }

        await db.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: empId, date } },
          create: payload,
          update: {
            deviceId: payload.deviceId,
            checkIn: payload.checkIn,
            checkOut: payload.checkOut,
            workHours: payload.workHours,
            status: payload.status,
            notes: payload.notes,
          },
        })
        synced++
      } catch (err) {
        errors.push(`Employee ${empId} on ${dateStr}: ${String(err)}`)
      }
    }
  }

  if (error) {
    errors.unshift(`Device warning: ${error}`)
  }

  return { synced, errors, usedSimulation: false }
}

// ─── Simulation fallback ──────────────────────────────────────────────────────

async function syncSimulated(
  deviceId: string,
  policyHour: number,
  policyMin: number,
  lateGraceMins: number,
  datesToSync: Date[],
): Promise<{ synced: number; errors: string[]; usedSimulation: true }> {
  // const lateThresholdMins = policyHour * 60 + policyMin + lateGraceMins // late-mark (DISABLED - do not delete)

  const employees = await db.employee.findMany({
    where: { isActive: true, status: "ACTIVE" },
    select: { id: true },
  })

  let synced = 0
  const errors: string[] = []

  for (const date of datesToSync) {
    const dayOfWeek = date.getUTCDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    for (const emp of employees) {
      try {
        if (isWeekend) {
          await db.attendanceLog.upsert({
            where: { employeeId_date: { employeeId: emp.id, date } },
            create: {
              employeeId: emp.id,
              deviceId,
              date,
              checkIn: null,
              checkOut: null,
              workHours: null,
              status: $Enums.AttendanceStatus.WEEKEND,
              isManual: false,
              notes: "Weekend - simulated",
            },
            update: { status: $Enums.AttendanceStatus.WEEKEND, deviceId },
          })
          synced++
          continue
        }

        const isAbsent = Math.random() < 0.05
        if (isAbsent) {
          await db.attendanceLog.upsert({
            where: { employeeId_date: { employeeId: emp.id, date } },
            create: {
              employeeId: emp.id,
              deviceId,
              date,
              checkIn: null,
              checkOut: null,
              workHours: null,
              status: $Enums.AttendanceStatus.ABSENT,
              isManual: false,
              notes: "Simulated absence",
            },
            update: { status: $Enums.AttendanceStatus.ABSENT, deviceId },
          })
          synced++
          continue
        }

        const checkInHour = randomBetween(8, 9)
        const checkInMin = checkInHour === 8 ? randomBetween(30, 59) : randomBetween(0, 30)
        const checkIn = buildDatetime(date, checkInHour, checkInMin)

        const checkOutHour = randomBetween(17, 18)
        const rawCheckOutMin = checkOutHour === 17 ? randomBetween(30, 59) : randomBetween(0, 60)
        const resolvedMin = rawCheckOutMin === 60 ? 0 : rawCheckOutMin
        const resolvedHour = rawCheckOutMin === 60 ? 19 : checkOutHour
        const checkOut = buildDatetime(date, resolvedHour, resolvedMin)

        const workHours =
          Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100

        // Derive status from hours worked (half-day / absent rules).
        const status = computeAttendanceStatus({ checkIn, workHours })

        // ── Late-mark logic (DISABLED for now - do not delete) ────────────────
        // const checkInTotalMins = checkInHour * 60 + checkInMin
        // const status: $Enums.AttendanceStatus =
        //   checkInTotalMins > lateThresholdMins
        //     ? $Enums.AttendanceStatus.LATE
        //     : $Enums.AttendanceStatus.PRESENT

        await db.attendanceLog.upsert({
          where: { employeeId_date: { employeeId: emp.id, date } },
          create: {
            employeeId: emp.id,
            deviceId,
            date,
            checkIn,
            checkOut,
            workHours,
            status,
            isManual: false,
            notes: "Simulated - device unreachable",
          },
          update: {
            deviceId,
            checkIn,
            checkOut,
            workHours,
            status,
            notes: "Simulated - device unreachable",
          },
        })
        synced++
      } catch (err) {
        errors.push(`Employee ${emp.id} on ${date.toISOString()}: ${String(err)}`)
      }
    }
  }

  return { synced, errors, usedSimulation: true }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }
      if (!device.isActive) {
        return NextResponse.json({ error: "Device is inactive" }, { status: 400 })
      }

      const policy = await db.attendancePolicy.findFirst({ where: { isDefault: true } })
      const lateGraceMins = policy?.lateGraceMins ?? 15
      const [policyHour, policyMin] = (policy?.checkInTime ?? "09:00").split(":").map(Number)

      // Build list of past 7 days (excluding today)
      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)
      const datesToSync: Date[] = []
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today)
        d.setUTCDate(d.getUTCDate() - i)
        datesToSync.push(d)
      }

      const deviceConfig = {
        ipAddress: device.ipAddress,
        port: device.port,
        username: device.username,
        password: device.password,
      }

      let syncResult: { synced: number; errors: string[]; usedSimulation: boolean }

      try {
        syncResult = await syncFromDevice(
          id,
          deviceConfig,
          policyHour,
          policyMin,
          lateGraceMins,
          datesToSync,
        )
      } catch (deviceErr) {
        // Device unreachable or auth failed - fall back to simulation
        const simResult = await syncSimulated(id, policyHour, policyMin, lateGraceMins, datesToSync)
        syncResult = {
          ...simResult,
          errors: [
            `Device unreachable (${deviceErr instanceof Error ? deviceErr.message : String(deviceErr)}) - used simulation`,
            ...simResult.errors,
          ],
        }
      }

      // Update lastSyncAt
      await db.hikvisionDevice.update({
        where: { id },
        data: { lastSyncAt: new Date() },
      })

      return NextResponse.json({
        message: `Sync complete. ${syncResult.synced} records processed.${syncResult.usedSimulation ? " (simulated)" : " (live device)"}`,
        synced: syncResult.synced,
        usedSimulation: syncResult.usedSimulation,
        errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
      })
    } catch (error) {
      console.error("[DEVICE_SYNC_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
