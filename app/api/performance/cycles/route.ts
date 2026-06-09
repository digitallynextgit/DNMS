import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth, withSession } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { createNotifications } from "@/lib/notifications"
import type { Session } from "next-auth"

export const GET = withSession(async (_req: NextRequest, _ctx: unknown, _session: Session) => {
  try {
    const cycles = await db.reviewCycle.findMany({
      orderBy: [{ year: "desc" }, { quarter: "desc" }],
      include: { _count: { select: { reviews: true } } },
    })
    return NextResponse.json({ data: cycles })
  } catch (error) {
    console.error("[CYCLES_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, _ctx: unknown, _session: Session) => {
    try {
      const body = await req.json()
      const { name, year, quarter, startDate, endDate } = body

      const cycle = await db.reviewCycle.create({
        data: {
          name,
          year: parseInt(year),
          quarter: quarter ? parseInt(quarter) : null,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
      })

      // Auto-create reviews for all active employees
      const employees = await db.employee.findMany({
        where: { isActive: true, status: "ACTIVE" },
        select: { id: true, managerId: true },
      })
      await db.performanceReview.createMany({
        data: employees.map((e) => ({
          cycleId: cycle.id,
          revieweeId: e.id,
          reviewerId: e.managerId ?? null,
        })),
        skipDuplicates: true,
      })

      // Notify all employees that a review cycle has started
      await createNotifications(
        employees.map((e) => ({
          employeeId: e.id,
          title: "Performance Review Started",
          message: `The "${name}" review cycle is now open. Please complete your self-review.`,
          type: "info" as const,
          link: "/performance/me",
        })),
      )

      return NextResponse.json({ data: cycle, reviewsCreated: employees.length }, { status: 201 })
    } catch (error) {
      console.error("[CYCLES_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
