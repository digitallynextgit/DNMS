import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  getBacklinks,
  importBacklinks,
  parseBacklinks,
} from "@/features/seo/server/seo.backlinks.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const runtime = "nodejs"

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

const importSchema = z.object({
  text: z.string().min(1).max(500_000),
  source: z.enum(["AWT", "GSC", "MANUAL"]).default("MANUAL"),
  // Treat this paste as the complete current backlink set (marks vanished links LOST).
  fullSnapshot: z.boolean().default(false),
})

// GET - referring-domain rollup + headline counts.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getBacklinks(propertyId!) })
  },
)

// POST - import (paste) a backlink export and diff it against what we had.
export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const body = importSchema.parse(await req.json())
    const rows = parseBacklinks(body.text)
    if (rows.length === 0)
      return NextResponse.json(
        { error: "No backlink URLs found. Paste one source URL per line (or a CSV export)." },
        { status: 422 },
      )
    const result = await importBacklinks(propertyId!, rows, {
      source: body.source,
      fullSnapshot: body.fullSnapshot,
    })
    if (!result) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: result })
  },
)
