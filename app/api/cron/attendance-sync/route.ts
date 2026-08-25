import { withCron } from "@/server/cron-auth"
import { db } from "@/server/db"
import { syncDeviceSmart } from "@/features/attendance/server/sync"
import { resolveDevice } from "@/features/attendance/server/device-resolver"

// Scheduled attendance sync. The DNMS server (running on the same LAN as the
// devices) polls every active Hikvision device and upserts attendance logs.
// Schedule a job to hit this, e.g. every 30 min:
//   GET /api/cron/attendance-sync  with header  Authorization: Bearer <CRON_SECRET>
//
// Smart per-employee: never-synced employees are fully backfilled (from their
// joining date); everyone else only re-pulls from their last recorded day → now,
// so steady-state runs stay cheap. Optional query params:
//   ?employeeNo=145  → sync only that employee (by HR code or device id)
//   ?full=1          → force a complete re-backfill for the targeted employees
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
