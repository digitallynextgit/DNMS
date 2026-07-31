import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { buildScorecard } from "@/features/seo/server/seo.scorecard"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

// GET - the latest stored scorecard. If none exists yet but the site HAS data to
// score, build one on the spot: a site with weeks of Search Console history was
// showing an empty Scorecard tab purely because nothing had triggered the first
// build (the weekly cron only fills it going forward). Read stays cheap in the
// normal case - the build happens at most once, then it's stored.
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

    // Nothing stored: only worth building if there is at least one snapshot,
    // otherwise every metric would be "no data" and the card would mislead.
    const hasData = await db.seoSnapshot.count({ where: { propertyId } })
    if (!hasData) return NextResponse.json({ data: null })

    const built = await buildScorecard(propertyId!)
    return NextResponse.json({ data: built })
  },
)

// POST - recompute now from whatever data is stored.
export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const card = await buildScorecard(propertyId!)
    return NextResponse.json({ data: card })
  },
)
