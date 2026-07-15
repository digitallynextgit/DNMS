import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// GET /api/projects/[id]/activity
export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const url = new URL(req.url)
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100)

      const activities = await db.projectActivity.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
        },
      })
      return NextResponse.json({ data: activities })
    } catch (error) {
      console.error("[PROJECT_ACTIVITY_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
