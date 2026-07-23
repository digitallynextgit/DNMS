import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { getSeoOverview } from "@/features/seo/server/seo.queries"
import { PERMISSIONS } from "@/lib/constants"

// GET - the growth report for ONE tracked site: latest window vs the previous,
// top queries/pages, money-keyword tracking, striking-distance and alerts.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id: projectId, propertyId } = ctx.params
    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const overview = await getSeoOverview(propertyId!)
    if (!overview) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: overview })
  },
)
