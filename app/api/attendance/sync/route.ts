import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { syncDeviceSmart } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"

// Refresh attendance for ALL employees by pulling the latest punches from every
// active device into the DB. Triggered by the "Refresh" button; any signed-in
// employee can run it. The DNMS server must be on the same network as the device
// - if no device is reachable we return a "connect to the WiFi" message.
//
// Per employee the sync is smart: someone never synced gets their full history
// backfilled (from their joining date); everyone else only re-pulls from their
// last recorded day → today. So Refresh stays cheap once everyone is seeded.

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

      let totalSynced = 0
      let reachable = 0
      const details: Array<{ device: string; synced?: number; error?: string }> = []

      for (const device of devices) {
        try {
          const r = await syncDeviceSmart(device.id, {
            ipAddress: device.ipAddress,
            port: device.port,
            username: device.username,
            password: device.password,
          })
          await db.hikvisionDevice.update({
            where: { id: device.id },
            data: { lastSyncAt: new Date() },
          })
          totalSynced += r.totalSynced
          reachable++
          details.push({ device: device.name, synced: r.totalSynced })
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
        message: `Attendance refreshed - ${totalSynced} records updated.`,
        synced: totalSynced,
        devices: details,
      })
    } catch (error) {
      console.error("[ATTENDANCE_SYNC_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
