import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import { EMPLOYEE_SUMMARY_SELECT } from "@/server/selects"
import type { Session } from "next-auth"

export const GET = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const { searchParams } = req.nextUrl
    const cycleId = searchParams.get("cycleId") ?? undefined
    const mine = searchParams.get("mine") === "true"
    const asReviewer = searchParams.get("asReviewer") === "true"

    const where: Record<string, unknown> = {}
    if (cycleId) where.cycleId = cycleId

    if (hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)) {
      // HR / reviewers can list across employees (optionally filtered).
      if (mine) where.revieweeId = session.user.id
      if (asReviewer) where.reviewerId = session.user.id
    } else {
      // Everyone else: only reviews where they are the reviewee or the reviewer.
      where.OR = [{ revieweeId: session.user.id }, { reviewerId: session.user.id }]
    }

    const reviews = await db.performanceReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        cycle: true,
        reviewee: {
          select: {
            ...EMPLOYEE_SUMMARY_SELECT,
            department: { select: { name: true } },
            designation: { select: { title: true } },
          },
        },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    return NextResponse.json({ data: reviews })
  } catch (error) {
    console.error("[REVIEWS_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
