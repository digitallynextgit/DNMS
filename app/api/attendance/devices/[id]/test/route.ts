import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { testDeviceConnection } from "@/features/attendance/server/hikvision"
import type { Session } from "next-auth"

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      const result = await testDeviceConnection({
        ipAddress: device.ipAddress,
        port: device.port,
        username: device.username,
        password: device.password,
      })

      return NextResponse.json(result)
    } catch (error) {
      console.error("[DEVICE_TEST_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
