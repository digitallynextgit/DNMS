import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  getKeywordBacklog,
  generateKeywordBacklog,
  mineCompetitorKeywords,
} from "@/features/seo/server/seo.keywords.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getKeywordBacklog(propertyId!) })
  },
)

// From our own Search Console queries (default) or by mining the latest competitor crawl.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    // The body is optional; a bare call just generates.
    const body = (await req.json().catch(() => ({}))) as { from?: string }

    if (body.from === "competitors") {
      const mined = await mineCompetitorKeywords(propertyId!)
      if (mined.error) return NextResponse.json({ error: mined.error }, { status: 400 })
      return NextResponse.json({ data: mined })
    }

    const result = await generateKeywordBacklog(propertyId!)
    return NextResponse.json({ data: result })
  },
)
