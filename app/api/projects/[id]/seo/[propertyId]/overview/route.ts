import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { getSeoOverview } from "@/features/seo/server/seo.queries"
import { PERMISSIONS } from "@/lib/constants"

// GET - the growth report for ONE tracked site: the chosen window vs the one
// before it, top queries/pages, money-keyword tracking, striking-distance and
// alerts.
//
// Query params (both optional):
//   end=YYYY-MM-DD  view the window ending on or before this date
//   weeks=1..52     how many stored weeks to combine
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, propertyId } = ctx.params
    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const params = req.nextUrl.searchParams
    const rawEnd = params.get("end")
    // Only accept a real ISO date; anything else falls back to the latest week
    // rather than being passed through to a query.
    const endDate = rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : null
    const rawWeeks = Number(params.get("weeks"))
    const weeks = Number.isFinite(rawWeeks) && rawWeeks > 0 ? Math.trunc(rawWeeks) : 1

    const overview = await getSeoOverview(propertyId!, { endDate, weeks })
    if (!overview) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: overview })
  },
)
