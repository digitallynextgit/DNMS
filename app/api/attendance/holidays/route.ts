import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withAuth(
  PERMISSIONS.ATTENDANCE_READ,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { searchParams } = new URL(req.url)
      const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined

      const where: Record<string, unknown> = {}
      if (year) {
        where.date = {
          gte: new Date(Date.UTC(year, 0, 1)),
          lte: new Date(Date.UTC(year, 11, 31)),
        }
      }

      const holidays = await db.holiday.findMany({
        where,
        orderBy: { date: "asc" },
      })

      return NextResponse.json({ data: holidays })
    } catch (error) {
      console.error("[HOLIDAYS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const { name, date, description, isOptional } = body

      if (!name || !date) {
        return NextResponse.json({ error: "name and date are required" }, { status: 400 })
      }

      const dateObj = new Date(date)
      dateObj.setUTCHours(0, 0, 0, 0)

      const holiday = await db.holiday.create({
        data: {
          name,
          date: dateObj,
          description: description ?? null,
          isOptional: isOptional ?? false,
        },
      })

      return NextResponse.json({ data: holiday }, { status: 201 })
    } catch (error: unknown) {
      console.error("[HOLIDAYS_POST]", error)
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
