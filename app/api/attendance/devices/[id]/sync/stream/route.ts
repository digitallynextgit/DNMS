import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { syncDeviceSmart, type SyncProgress } from "@/features/attendance/server/sync"
import type { Session } from "next-auth"

/**
 * POST /api/attendance/devices/[id]/sync/stream
 *
 * Same sync as the plain route, but streams NDJSON progress lines as it goes:
 *
 *   {"type":"progress", ...SyncProgress}\n
 *   {"type":"progress", ...}\n
 *   {"type":"done","synced":42,"employees":[...]}\n
 *   {"type":"error","error":"..."}\n
 *
 * A full backfill walks hundreds of device windows and can run for minutes. The
 * non-streaming route gives the UI nothing to show until it finishes, so the button
 * just spins with no idea whether it is 10% or 90% done. Here the server reports
 * after every window - and because the total window count is known BEFORE the walk
 * starts, the percentage and the ETA are real measurements, not a guess.
 *
 * Query params match the plain route: ?employeeNo=145, ?full=1
 */
export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    const { id } = ctx.params
    const onlyEmployeeNo = req.nextUrl.searchParams.get("employeeNo") ?? undefined
    const full = req.nextUrl.searchParams.get("full") === "1"

    const device = await db.hikvisionDevice.findUnique({ where: { id } })
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    if (!device.isActive) return NextResponse.json({ error: "Device is inactive" }, { status: 400 })

    const deviceConfig = {
      ipAddress: device.ipAddress,
      port: device.port,
      username: device.username,
      password: device.password,
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"))
          } catch {
            // client disconnected mid-sync - nothing to do, the walk finishes anyway
          }
        }

        try {
          const result = await syncDeviceSmart(id, deviceConfig, {
            onlyEmployeeNo,
            full,
            onProgress: (p: SyncProgress) => send({ type: "progress", ...p }),
          })

          // Only a completed, whole-device run may advance lastSyncAt - see the note
          // in the sibling route.
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
        // Stop any intermediate proxy from buffering the stream (which would defeat
        // the whole point - the UI would get every line at once, at the end).
        "X-Accel-Buffering": "no",
      },
    })
  },
)
