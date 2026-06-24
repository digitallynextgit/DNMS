import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

// Each employee may pick this many of the optional (floating) holidays per year.
export const FLOATING_HOLIDAY_LIMIT = 3

/**
 * GET /api/attendance/floating-holidays?year=2026
 * Returns the optional holidays for the year plus the current employee's picks.
 */
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const yearParam = new URL(req.url).searchParams.get("year")
      const year = yearParam ? Number(yearParam) : new Date().getUTCFullYear()

      const [optionalHolidays, selections] = await Promise.all([
        db.holiday.findMany({
          where: {
            isOptional: true,
            date: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lte: new Date(Date.UTC(year, 11, 31)),
            },
          },
          orderBy: { date: "asc" },
        }),
        db.floatingHolidaySelection.findMany({
          where: { employeeId: session.user.id, year },
          select: { holidayId: true },
        }),
      ])

      const selectedHolidayIds = selections.map((s) => s.holidayId)

      return NextResponse.json({
        data: {
          year,
          limit: FLOATING_HOLIDAY_LIMIT,
          remaining: Math.max(0, FLOATING_HOLIDAY_LIMIT - selectedHolidayIds.length),
          optionalHolidays,
          selectedHolidayIds,
        },
      })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/**
 * POST /api/attendance/floating-holidays   body: { holidayId }
 * Picks a floating holiday for the current employee (enforces the per-year limit).
 */
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { holidayId } = await req.json()
      if (!holidayId) {
        return NextResponse.json({ error: "holidayId is required" }, { status: 400 })
      }

      const holiday = await db.holiday.findUnique({ where: { id: holidayId } })
      if (!holiday) {
        return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
      }
      if (!holiday.isOptional) {
        return NextResponse.json(
          { error: "Only optional (floating) holidays can be selected" },
          { status: 422 },
        )
      }

      const year = new Date(holiday.date).getUTCFullYear()

      // Already picked? Treat as success (idempotent).
      const existing = await db.floatingHolidaySelection.findUnique({
        where: {
          employeeId_holidayId_year: { employeeId: session.user.id, holidayId, year },
        },
      })
      if (existing) {
        return NextResponse.json({ data: existing })
      }

      const count = await db.floatingHolidaySelection.count({
        where: { employeeId: session.user.id, year },
      })
      if (count >= FLOATING_HOLIDAY_LIMIT) {
        return NextResponse.json(
          {
            error: `You can only pick ${FLOATING_HOLIDAY_LIMIT} floating holidays for ${year}. Remove one first.`,
          },
          { status: 422 },
        )
      }

      const selection = await db.floatingHolidaySelection.create({
        data: {
          employeeId: session.user.id,
          holidayId,
          year,
          status: "APPROVED",
        },
      })

      return NextResponse.json({ data: selection }, { status: 201 })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

/**
 * DELETE /api/attendance/floating-holidays?holidayId=...
 * Removes the current employee's pick so they can choose a different one.
 */
export const DELETE = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const holidayId = new URL(req.url).searchParams.get("holidayId")
      if (!holidayId) {
        return NextResponse.json({ error: "holidayId is required" }, { status: 400 })
      }

      await db.floatingHolidaySelection.deleteMany({
        where: { employeeId: session.user.id, holidayId },
      })

      return NextResponse.json({ message: "Floating holiday removed" })
    } catch (error) {
      console.error("[FLOATING_HOLIDAYS_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
