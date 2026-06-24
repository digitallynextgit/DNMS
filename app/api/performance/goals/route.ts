import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    // Only HR / reviewers may look up another employee's goals; everyone else is
    // forced to their own regardless of the employeeId param.
    const requestedId = req.nextUrl.searchParams.get("employeeId")
    const employeeId =
      requestedId && hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)
        ? requestedId
        : session.user.id
    const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(new Date().getFullYear()))

    const goals = await db.goal.findMany({
      where: { employeeId, year },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ data: goals })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const POST = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const body = await req.json()
    const { title, description, targetDate, year } = body

    const goal = await db.goal.create({
      data: {
        employeeId: session.user.id,
        title,
        description,
        targetDate: targetDate ? new Date(targetDate) : null,
        year: year ? parseInt(year) : new Date().getFullYear(),
      },
    })
    return NextResponse.json({ data: goal }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
