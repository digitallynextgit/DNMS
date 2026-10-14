import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { resolveProjectId, withProjectManager } from "@/features/projects/server/project-access"
import { buildScorecard } from "@/features/seo/server/seo.scorecard"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Reads use plain withAuth, so the URL segment may still be the slug; writes get it resolved.
async function owned(projectRef: string, propertyId: string) {
  const projectId = await resolveProjectId(projectRef)
  if (!projectId) return null
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

// Builds the first scorecard on read if the site has data but none is stored yet (the weekly cron
// only fills it going forward).
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const card = await db.seoScorecard.findFirst({
      where: { propertyId },
      orderBy: { periodEnd: "desc" },
    })
    if (card) return NextResponse.json({ data: card })

    // Only build with at least one snapshot; otherwise every metric would read "no data".
    const hasData = await db.seoSnapshot.count({ where: { propertyId } })
    if (!hasData) return NextResponse.json({ data: null })

    const built = await buildScorecard(propertyId!)
    return NextResponse.json({ data: built })
  },
)

export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const card = await buildScorecard(propertyId!)
    return NextResponse.json({ data: card })
  },
)
