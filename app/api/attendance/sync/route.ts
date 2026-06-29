import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { syncDeviceAttendance, recentDates } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"

// Refresh attendance for ALL employees by pulling the latest punches from every
// active device into the DB. Triggered by the "Refresh" button; any signed-in
// employee can run it. The DNMS server must be on the same network as the device
// — if no device is reachable we return a "connect to the WiFi" message.
// Recent window the Refresh button re-pulls (full history is backfilled separately;
// day-to-day only the last couple weeks change). Kept small so the request stays
// well under typical reverse-proxy timeouts.
const SYNC_DAYS = 14

export const POST = withSession(
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const devices = await db.hikvisionDevice.findMany({ where: { isActive: true } })
      if (devices.length === 0) {
        return NextResponse.json(
          { error: "No attendance device is configured. Add one under Attendance → Devices." },
          { status: 400 },
        )
      }

      const dates = recentDates(SYNC_DAYS)
      let totalSynced = 0
      let reachable = 0
      const details: Array<{ device: string; synced?: number; error?: string }> = []

      for (const device of devices) {
        try {
          const r = await syncDeviceAttendance(
            device.id,
            {
              ipAddress: device.ipAddress,
              port: device.port,
              username: device.username,
              password: device.password,
            },
            dates,
          )
          await db.hikvisionDevice.update({
            where: { id: device.id },
            data: { lastSyncAt: new Date() },
          })
          totalSynced += r.synced
          reachable++
          details.push({ device: device.name, synced: r.synced })
        } catch (err) {
          details.push({
            device: device.name,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      if (reachable === 0) {
        return NextResponse.json(
          {
            error:
              "Couldn't reach the attendance device. Please connect to the DigitallyNext WiFi and try again.",
          },
          { status: 503 },
        )
      }

      return NextResponse.json({
        message: `Attendance refreshed — ${totalSynced} records updated.`,
        synced: totalSynced,
        devices: details,
      })
    } catch (error) {
      console.error("[ATTENDANCE_SYNC_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
