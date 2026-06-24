import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { hasPermission } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

const reviewerSelect = { select: { id: true, firstName: true, lastName: true, profilePhoto: true } }

// GET ?reviewId= - peer feedback for a review (reviewee, the peers, or HR).
export const GET = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const reviewId = new URL(req.url).searchParams.get("reviewId")
      if (!reviewId) return NextResponse.json({ error: "reviewId required" }, { status: 400 })

      const review = await db.performanceReview.findUnique({
        where: { id: reviewId },
        select: { revieweeId: true },
      })
      if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })

      const canViewAll = hasPermission(session, PERMISSIONS.PERFORMANCE_REVIEW)
      const feedback = await db.peerFeedback.findMany({
        where: { reviewId },
        include: { reviewer: reviewerSelect },
        orderBy: { createdAt: "desc" },
      })
      // Reviewee + HR see all; a peer only sees their own entry.
      const visible =
        canViewAll || review.revieweeId === session.user.id
          ? feedback
          : feedback.filter((f) => f.reviewerId === session.user.id)
      return NextResponse.json({ data: visible })
    } catch (error) {
      console.error("[PEER_FEEDBACK_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST { reviewId, rating, comment } - current user leaves/updates peer feedback.
export const POST = withSession(
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { reviewId, rating, comment } = await req.json()
      if (!reviewId) return NextResponse.json({ error: "reviewId required" }, { status: 400 })

      const review = await db.performanceReview.findUnique({
        where: { id: reviewId },
        select: { revieweeId: true },
      })
      if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })
      if (review.revieweeId === session.user.id) {
        return NextResponse.json(
          { error: "You can't give peer feedback on your own review" },
          { status: 422 },
        )
      }

      const fb = await db.peerFeedback.upsert({
        where: { reviewId_reviewerId: { reviewId, reviewerId: session.user.id } },
        update: { rating: rating != null ? Number(rating) : null, comment: comment || null },
        create: {
          reviewId,
          reviewerId: session.user.id,
          rating: rating != null ? Number(rating) : null,
          comment: comment || null,
        },
        include: { reviewer: reviewerSelect },
      })
      return NextResponse.json({ data: fb }, { status: 201 })
    } catch (error) {
      console.error("[PEER_FEEDBACK_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
