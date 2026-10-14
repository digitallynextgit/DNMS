import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { resolveProjectId, withProjectManager } from "@/features/projects/server/project-access"
import { getCompetitorAudit, runCompetitorGap } from "@/features/seo/server/seo.competitor.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// Sequential live crawls of several sites are slow, so give the run room.
export const runtime = "nodejs"
export const maxDuration = 300

// Reads use plain withAuth, so the URL segment may still be the slug; writes get it resolved.
async function owned(projectRef: string, propertyId: string) {
  const projectId = await resolveProjectId(projectRef)
  if (!projectId) return null
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getCompetitorAudit(propertyId!) })
  },
)

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
