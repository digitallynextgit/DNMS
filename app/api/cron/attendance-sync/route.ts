import { withCron } from "@/server/cron-auth"
import { db } from "@/server/db"
import { syncDeviceSmart } from "@/features/attendance/server/sync"
import { resolveDevice } from "@/features/attendance/server/device-resolver"

// Run (e.g. every 30 min) from a host on the devices' LAN. Same ?employeeNo= / ?full=1 options
// as the device sync route.
export const dynamic = "force-dynamic"

export const GET = withCron("attendance-sync", async (req) => {
  const onlyEmployeeNo = req.nextUrl.searchParams.get("employeeNo") ?? undefined
  const full = req.nextUrl.searchParams.get("full") === "1"

  const devices = await db.hikvisionDevice.findMany({ where: { isActive: true } })
  const results: Array<{
    device: string
    synced?: number
    employees?: unknown
    error?: string
  }> = []

  for (const device of devices) {
    try {
      const r = await syncDeviceSmart(device.id, (await resolveDevice(device)).config, {
        onlyEmployeeNo,
        full,
      })
      await db.hikvisionDevice.update({
        where: { id: device.id },
        data: { lastSyncAt: new Date() },
      })
      results.push({ device: device.name, synced: r.totalSynced, employees: r.results })
    } catch (err) {
      results.push({ device: device.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return { devices: results }
})
