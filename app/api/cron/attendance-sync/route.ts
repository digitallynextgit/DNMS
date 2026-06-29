import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { syncDeviceAttendance, recentDates } from "@/features/attendance/server/sync"

// Scheduled attendance sync. The DNMS server (running on the same LAN as the
// devices) polls every active Hikvision device and upserts attendance logs.
// Schedule a job to hit this, e.g. every 30 min:
//   GET /api/cron/attendance-sync  with header  Authorization: Bearer <CRON_SECRET>
// ?days=N controls how many recent days (incl. today) to re-sync (default 3).
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const days = Math.min(31, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? "3")))
  const dates = recentDates(days)

  const devices = await db.hikvisionDevice.findMany({ where: { isActive: true } })
  const results: Array<{ device: string; synced?: number; error?: string }> = []

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
      results.push({ device: device.name, synced: r.synced })
    } catch (err) {
      results.push({ device: device.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), devices: results })
}
