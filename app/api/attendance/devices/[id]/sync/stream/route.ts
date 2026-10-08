import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { syncDeviceSmart, type SyncProgress } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"
import { resolveDevice } from "@/features/attendance/server/device-resolver"

/** Same sync as ../sync, but streams NDJSON progress lines (progress, done, error). */
export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id } = ctx.params
    const onlyEmployeeNo = req.nextUrl.searchParams.get("employeeNo") ?? undefined
    const full = req.nextUrl.searchParams.get("full") === "1"

    const device = await db.hikvisionDevice.findUnique({ where: { id } })
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    if (!device.isActive) return NextResponse.json({ error: "Device is inactive" }, { status: 400 })

    const resolved = await resolveDevice(device)
    const deviceConfig = resolved.config

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
          } catch {
            // Client disconnected; the sync finishes anyway.
          }
        }

        try {
          const result = await syncDeviceSmart(id, deviceConfig, {
            onlyEmployeeNo,
            full,
            onProgress: (p: SyncProgress) => send({ type: "progress", ...p }),
          })

          if (!onlyEmployeeNo && result.completed) {
            await db.hikvisionDevice.update({ where: { id }, data: { lastSyncAt: new Date() } })
          }

          send({
            type: "done",
            synced: result.totalSynced,
            completed: result.completed,
            employees: result.results,
            message: `Sync complete. ${result.totalSynced} records processed.`,
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          send({ type: "error", error: `Device unreachable or sync failed: ${msg}` })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        // Stop proxies from buffering the stream.
        "X-Accel-Buffering": "no",
      },
    })
  },
)
