import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// PATCH a review cycle - close/reopen (isClosed) or activate/deactivate (isActive).
export const PATCH = withAuth(
  PERMISSIONS.PERFORMANCE_REVIEW,
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const data: Record<string, unknown> = {}
      if (body.isClosed !== undefined) data.isClosed = !!body.isClosed
      if (body.isActive !== undefined) data.isActive = !!body.isActive
      if (body.name !== undefined) data.name = String(body.name)
      const cycle = await db.reviewCycle.update({ where: { id: ctx.params.id }, data })
      return NextResponse.json({ data: cycle })
    } catch (error) {
      console.error("[CYCLE_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
