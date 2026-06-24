import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import type { Session } from "next-auth"

export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { searchParams } = new URL(req.url)

      const daysBack = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "30")))
      const status = searchParams.get("status") ?? undefined
      const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
      const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "30")))
      const skip = (page - 1) * limit

      const dateFrom = new Date()
      dateFrom.setUTCDate(dateFrom.getUTCDate() - daysBack)
      dateFrom.setUTCHours(0, 0, 0, 0)

      const where: Record<string, unknown> = {
        employeeId: session.user.id,
        date: { gte: dateFrom },
      }

      if (status) where.status = status

      const [logs, total] = await Promise.all([
        db.attendanceLog.findMany({
          where,
          orderBy: { date: "desc" },
          skip,
          take: limit,
        }),
        db.attendanceLog.count({ where }),
      ])

      return NextResponse.json({
        data: logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      console.error("[ATTENDANCE_ME_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
