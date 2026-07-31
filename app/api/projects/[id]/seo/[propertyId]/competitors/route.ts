import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { getCompetitorAudit, runCompetitorGap } from "@/features/seo/server/seo.competitor.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Crawling several competitor sites is slow (sequential live fetches), so give
// the run room. Node runtime for fetch + Prisma.
export const runtime = "nodejs"
export const maxDuration = 300

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

// GET - the latest competitor gap analysis for this site.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getCompetitorAudit(propertyId!) })
  },
)

// POST - run a fresh competitor crawl + gap diff now.
export const POST = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const result = await runCompetitorGap(propertyId!)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ data: result })
  },
)
