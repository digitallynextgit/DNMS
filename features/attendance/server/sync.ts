import "server-only"

import { db } from "@/server/db"
import { fetchAttendanceEvents, testDeviceConnection } from "@/features/attendance/server/hikvision"
import { computeAttendanceStatus } from "@/features/attendance/attendance"

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

/**
 * Pull person punches from a Hikvision device for the date window covered by
 * `datesToSync` (its earliest..latest day) and upsert ONE attendance record per
 * employee per day they actually punched. Weekends, holidays and absences are
 * NOT stored — the calendar/summary derive those — so we only ever write real
 * punch data. Throws DeviceUnreachableError when the device can't be reached.
 */
export async function syncDeviceAttendance(
  deviceId: string,
  deviceConfig: DeviceConfig,
  datesToSync: Date[],
): Promise<{ synced: number; errors: string[] }> {
  if (datesToSync.length === 0) return { synced: 0, errors: [] }

  // Connectivity probe first → a clean "not on the network" signal.
  const probe = await testDeviceConnection(deviceConfig)
  if (!probe.success) throw new DeviceUnreachableError(probe.message)

  const sorted = [...datesToSync].sort((a, b) => a.getTime() - b.getTime())
  const rangeStart = new Date(sorted[0])
  rangeStart.setUTCHours(0, 0, 0, 0)
  const rangeEnd = new Date(sorted[sorted.length - 1])
  rangeEnd.setUTCHours(23, 59, 59, 999)

  // major=5, minor=75 → only person access-grants (the actual punches).
  const { events, error } = await fetchAttendanceEvents(deviceConfig, rangeStart, rangeEnd, 5, 75)
  const errors: string[] = []
  if (error) errors.push(error)

  const employees = await db.employee.findMany({
    where: { isActive: true, status: "ACTIVE" },
    select: { id: true, employeeNo: true, deviceId: true },
  })
  const employeeByNo = new Map<string, string>()
  for (const e of employees) {
    employeeByNo.set(e.employeeNo, e.id)
    if (e.deviceId) employeeByNo.set(e.deviceId, e.id)
  }

  // Group punches by employee + day.
  const byDay = new Map<string, Date[]>() // key: "employeeId|YYYY-MM-DD"
  for (const ev of events) {
    const empId = employeeByNo.get(ev.employeeNo)
    if (!empId) continue
    const key = `${empId}|${ev.timestamp.toISOString().slice(0, 10)}`
    const arr = byDay.get(key)
    if (arr) arr.push(ev.timestamp)
    else byDay.set(key, [ev.timestamp])
  }

  let synced = 0
  for (const [key, arr] of byDay) {
    const sep = key.indexOf("|")
    const empId = key.slice(0, sep)
    const dateStr = key.slice(sep + 1)
    const date = new Date(`${dateStr}T00:00:00.000Z`)

    arr.sort((a, b) => a.getTime() - b.getTime())
    const checkIn = arr[0]
    const checkOut = arr.length > 1 ? arr[arr.length - 1] : null
    let workHours: number | null = null
    if (checkIn && checkOut && checkOut > checkIn) {
      workHours =
        Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100
    }
    const status = computeAttendanceStatus({ checkIn, workHours })

    try {
      await db.attendanceLog.upsert({
        where: { employeeId_date: { employeeId: empId, date } },
        create: {
          employeeId: empId,
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
      synced++
    } catch (err) {
      errors.push(`${key}: ${String(err)}`)
    }
  }

  return { synced, errors }
}

/** Build a list of the last `days` UTC-midnight dates, including today. */
export function recentDates(days: number): Date[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const out: Date[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(d)
  }
  return out
}
