import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { syncDeviceSmart } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"
import { resolveDevice } from "@/features/attendance/server/device-resolver"

// Manually trigger a sync for one device. The DNMS must be able to reach the
// device (run it on the same network). NO simulation fallback - if the device is
// unreachable this returns an error rather than inventing data.
//
// Smart per-employee window: never-synced employees get a full backfill, the rest
// just re-pull from their last recorded day. Optional query params:
//   ?employeeNo=145  → sync only that employee (by HR code or device id)
//   ?full=1          → force a complete re-backfill (ignore existing data)
export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const onlyEmployeeNo = req.nextUrl.searchParams.get("employeeNo") ?? undefined
      const full = req.nextUrl.searchParams.get("full") === "1"

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
      if (!device.isActive)
        return NextResponse.json({ error: "Device is inactive" }, { status: 400 })

      const resolved = await resolveDevice(device)
      if (resolved.error) {
        return NextResponse.json({ error: resolved.error }, { status: 502 })
      }
      const deviceConfig = resolved.config

      let result: Awaited<ReturnType<typeof syncDeviceSmart>>
      try {
        result = await syncDeviceSmart(id, deviceConfig, { onlyEmployeeNo, full })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json(
          { error: `Device unreachable or sync failed: ${msg}` },
          { status: 502 },
        )
      }

      // Only a whole-device sync advances lastSyncAt - a single-employee sync must
      // not make the next incremental sync think everyone is up to date. And only a
      // run that COMPLETED the whole span may advance it: `lastSyncAt` is now what
      // decides whether an employee has been covered, so advancing it after a run
      // that bailed on device errors would mark people as synced whose older windows
      // were never fetched.
      if (!onlyEmployeeNo && result.completed) {
        await db.hikvisionDevice.update({ where: { id }, data: { lastSyncAt: new Date() } })
      }

      return NextResponse.json({
        message:
          `Sync complete. ${result.totalSynced} records processed.` +
          (resolved.relocated ? ` Device had moved to ${deviceConfig.ipAddress}.` : ""),
        synced: result.totalSynced,
        employees: result.results,
      })
    } catch (error) {
      console.error("[DEVICE_SYNC_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
