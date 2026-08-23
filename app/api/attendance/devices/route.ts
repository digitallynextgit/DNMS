import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"
import type { HikvisionDevice } from "@prisma/client"

/**
 * The device admin password must never reach the browser - it is only needed
 * server-side by the sync path (device-resolver / hikvision), which reads its own
 * DB rows. Strip it from every API response and expose a boolean instead so the
 * UI can still show whether one is set.
 */
function redactDevice({ password, ...rest }: HikvisionDevice) {
  return { ...rest, hasPassword: !!password }
}

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const devices = await db.hikvisionDevice.findMany({
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({ data: devices.map(redactDevice) })
    } catch (error) {
      console.error("[DEVICES_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const { name, deviceSerial, ipAddress, port, username, password, location } = body

      if (!name || !deviceSerial || !ipAddress || !password) {
        return NextResponse.json(
          { error: "name, deviceSerial, ipAddress, and password are required" },
          { status: 400 },
        )
      }

      const device = await db.hikvisionDevice.create({
        data: {
          name,
          deviceSerial,
          ipAddress,
          port: port ?? 8000,
          username: username ?? "admin",
          password,
          location: location ?? null,
          isActive: true,
        },
      })

      return NextResponse.json({ data: redactDevice(device) }, { status: 201 })
    } catch (error: unknown) {
      console.error("[DEVICES_POST]", error)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A device with this serial number already exists" },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
