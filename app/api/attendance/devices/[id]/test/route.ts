import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { testDeviceConnection } from "@/features/attendance/server/hikvision"
import type { Session } from "next-auth"
import { resolveDevice } from "@/features/attendance/server/device-resolver"

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      const resolved = await resolveDevice(device)
      if (resolved.error) {
        // A plain "404" told nobody anything. Say what was actually wrong.
        return NextResponse.json({ success: false, message: resolved.error })
      }

      const result = await testDeviceConnection(resolved.config)

      return NextResponse.json({
        ...result,
        message: resolved.relocated
          ? `${result.message}. The device had moved to ${resolved.config.ipAddress} - address updated.`
          : result.message,
        ipAddress: resolved.config.ipAddress,
        relocated: resolved.relocated,
      })
    } catch (error) {
      console.error("[DEVICE_TEST_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
