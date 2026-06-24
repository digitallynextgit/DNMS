import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const device = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!device) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      return NextResponse.json({ data: device })
    } catch (error) {
      console.error("[DEVICE_ID_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const PATCH = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()

      const existing = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}

      if (body.name !== undefined) updateData.name = body.name
      if (body.deviceSerial !== undefined) updateData.deviceSerial = body.deviceSerial
      if (body.ipAddress !== undefined) updateData.ipAddress = body.ipAddress
      if (body.port !== undefined) updateData.port = body.port
      if (body.username !== undefined) updateData.username = body.username
      if (body.password !== undefined) updateData.password = body.password
      if (body.location !== undefined) updateData.location = body.location ?? null
      if (body.isActive !== undefined) updateData.isActive = body.isActive

      const device = await db.hikvisionDevice.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ data: device })
    } catch (error: unknown) {
      console.error("[DEVICE_ID_PATCH]", error)
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

export const DELETE = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params

      const existing = await db.hikvisionDevice.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Device not found" }, { status: 404 })
      }

      await db.hikvisionDevice.delete({ where: { id } })

      return NextResponse.json({ message: "Device deleted successfully" })
    } catch (error) {
      console.error("[DEVICE_ID_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
