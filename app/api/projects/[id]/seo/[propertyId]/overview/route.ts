import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { getSeoOverview } from "@/features/seo/server/seo.queries"
import { resolveProjectId } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"

export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { propertyId } = ctx.params
    // Plain withAuth doesn't resolve the slug, and the ownership check below needs the real id.
    const projectId = await resolveProjectId(ctx.params.id)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const params = req.nextUrl.searchParams
    const rawEnd = params.get("end")
    // Only a real ISO date; anything else falls back to the latest week.
    const endDate = rawEnd && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd) ? rawEnd : null
    const rawWeeks = Number(params.get("weeks"))
    const weeks = Number.isFinite(rawWeeks) && rawWeeks > 0 ? Math.trunc(rawWeeks) : 1

    const overview = await getSeoOverview(propertyId!, { endDate, weeks })
    if (!overview) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: overview })
  },
)
