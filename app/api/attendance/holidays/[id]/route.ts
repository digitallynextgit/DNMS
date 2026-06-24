import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const PATCH = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id } = ctx.params
      const body = await req.json()

      const existing = await db.holiday.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
      }

      const updateData: Record<string, unknown> = {}

      if (body.name !== undefined) updateData.name = body.name
      if (body.date !== undefined) {
        const dateObj = new Date(body.date)
        dateObj.setUTCHours(0, 0, 0, 0)
        updateData.date = dateObj
      }
      if (body.description !== undefined) updateData.description = body.description ?? null
      if (body.isOptional !== undefined) updateData.isOptional = body.isOptional

      const holiday = await db.holiday.update({
        where: { id },
        data: updateData,
      })

      return NextResponse.json({ data: holiday })
    } catch (error: unknown) {
      console.error("[HOLIDAY_ID_PATCH]", error)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "A holiday with this name already exists on that date" },
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

      const existing = await db.holiday.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
      }

      await db.holiday.delete({ where: { id } })

      return NextResponse.json({ message: "Holiday deleted successfully" })
    } catch (error) {
      console.error("[HOLIDAY_ID_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
