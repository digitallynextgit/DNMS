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

// GET - the latest stored scorecard (cheap read; does not recompute).
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
    return NextResponse.json({ data: card })
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
