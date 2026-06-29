import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { syncDeviceAttendance, recentDates } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"

// Manually trigger a sync for one device. The DNMS must be able to reach the
// device (run it on the same network). NO simulation fallback — if the device is
// unreachable this returns an error rather than inventing data.
export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
      if (!device.isActive)
        return NextResponse.json({ error: "Device is inactive" }, { status: 400 })

      const deviceConfig = {
        ipAddress: device.ipAddress,
        port: device.port,
        username: device.username,
        password: device.password,
      }

      let result: { synced: number; errors: string[] }
      try {
        // Sync the last 8 days (incl. today) so corrections are picked up.
        result = await syncDeviceAttendance(id, deviceConfig, recentDates(8))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json(
          { error: `Device unreachable or sync failed: ${msg}` },
          { status: 502 },
        )
      }

      await db.hikvisionDevice.update({ where: { id }, data: { lastSyncAt: new Date() } })

      return NextResponse.json({
        message: `Sync complete. ${result.synced} records processed.`,
        synced: result.synced,
        errors: result.errors.length > 0 ? result.errors : undefined,
      })
    } catch (error) {
      console.error("[DEVICE_SYNC_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
