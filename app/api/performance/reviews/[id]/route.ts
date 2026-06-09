import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withSession } from "@/lib/permissions"
import type { Session } from "next-auth"

export const PATCH = withSession(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const review = await db.performanceReview.findUnique({ where: { id: ctx.params.id } })
      if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })

      const isReviewee = review.revieweeId === session.user.id
      const isReviewer = review.reviewerId === session.user.id
      const isSuperAdmin =
        session.user.roles?.includes("super_admin") || session.user.roles?.includes("hr_admin")

      if (!isReviewee && !isReviewer && !isSuperAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }

      const data: Record<string, unknown> = {}

      // Reviewee fields
      if (isReviewee || isSuperAdmin) {
        if (body.selfRating !== undefined)
          data.selfRating = body.selfRating ? parseFloat(body.selfRating) : null
        if (body.selfComments !== undefined) data.selfComments = body.selfComments
        if (body.achievements !== undefined) data.achievements = body.achievements
        if (body.improvements !== undefined) data.improvements = body.improvements
        if (body.status === "SELF_REVIEW") {
          data.status = "SELF_REVIEW"
          data.submittedAt = new Date()
        }
      }

      // Reviewer / admin fields
      if (isReviewer || isSuperAdmin) {
        if (body.managerRating !== undefined)
          data.managerRating = body.managerRating ? parseFloat(body.managerRating) : null
        if (body.managerComments !== undefined) data.managerComments = body.managerComments
        if (body.status === "COMPLETED") {
          data.status = "COMPLETED"
          data.completedAt = new Date()
          // Compute final rating: 60% manager + 40% self
          const managerRating = body.managerRating
            ? parseFloat(body.managerRating)
            : (review.managerRating ?? 0)
          const selfRating = review.selfRating ?? 0
          data.finalRating = Math.round((managerRating * 0.6 + selfRating * 0.4) * 10) / 10
        }
      }

      const updated = await db.performanceReview.update({ where: { id: ctx.params.id }, data })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[REVIEW_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
