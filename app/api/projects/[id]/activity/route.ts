import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

/**
 * What survives the "Key events" filter.
 *
 * The feed is dominated by routine task churn - on this project, 209 status
 * changes and 153 task creations against 16 requirement events - so scanning it
 * for the thing that actually mattered means scrolling past everything that did
 * not. These are the entries that change scope, ownership or outcome.
 *
 * Task status changes are the interesting case: moving something to IN_PROGRESS
 * is routine, finishing or abandoning it is not. So the type is included only
 * for terminal transitions, handled separately below.
 */
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

// GET /api/projects/[id]/activity?key=1
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
          // Filtered in SQL, not after fetching: trimming a page client-side
          // would leave "key events" showing whatever few survived the most
          // recent 50 rows, which is a different thing entirely.
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
