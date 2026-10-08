import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

/** Entries that change scope, ownership or outcome. Task status changes count only when terminal (below). */
const KEY_TYPES = [
  "TASK_APPROVED",
  "TASK_REJECTED",
  "TASK_DELETED",
  "TEAM_CREATED",
  "TEAM_MEMBER_ADDED",
  "TEAM_MEMBER_REMOVED",
  "MILESTONE_TOGGLED",
  "REQUIREMENT_RAISED",
  "REQUIREMENT_STATUS_CHANGED",
]

/** Task states worth surfacing on their own: finished, parked, or dropped. */
const KEY_STATUSES = ["DONE", "ON_HOLD", "DISCARDED"]

export const GET = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const url = new URL(req.url)
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100)
      const keyOnly = url.searchParams.get("key") === "1"

      const activities = await db.projectActivity.findMany({
        where: {
          projectId,
          // Filtered in SQL, so key events aren't just whatever survived the latest 50 rows.
          ...(keyOnly
            ? {
                OR: [
                  { type: { in: KEY_TYPES } },
                  ...KEY_STATUSES.map((s) => ({
                    type: "TASK_STATUS_CHANGED",
                    meta: { path: ["to"], equals: s },
                  })),
                ],
              }
            : {}),
        },
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
