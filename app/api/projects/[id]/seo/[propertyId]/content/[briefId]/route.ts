import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/server/db"
import { withProjectManager } from "@/features/projects/server/project-access"
import { updateBrief, runBriefQa, deleteBrief } from "@/features/seo/server/seo.content.service"
import type { Session } from "next-auth"

// QA re-crawls a live URL, so allow generous time.
export const runtime = "nodejs"
export const maxDuration = 60

async function owned(projectId: string, propertyId: string) {
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

const patchSchema = z.object({
  // "qa" re-crawls `url` and grades it; otherwise the given fields are updated.
  action: z.enum(["update", "qa"]).default("update"),
  url: z.string().url().optional(),
  status: z.enum(["BRIEF", "WRITING", "REVIEW", "PUBLISHED", "MEASURED", "PARKED"]).optional(),
  outline: z.array(z.string().max(200)).max(30).optional(),
  angle: z.string().max(2000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  publishedUrl: z.string().url().nullable().optional(),
})

// PATCH - update a brief's fields, or run its QA gate (action: "qa", url).
export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId, briefId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })

    const body = patchSchema.parse(await req.json())

    if (body.action === "qa") {
      if (!body.url)
        return NextResponse.json(
          { error: "A published URL is required to run QA" },
          { status: 422 },
        )
      const updated = await runBriefQa(propertyId!, briefId!, body.url)
      if (!updated) return NextResponse.json({ error: "Brief not found" }, { status: 404 })
      return NextResponse.json({ data: updated })
    }

    const { action: _a, url: _u, ...patch } = body
    const updated = await updateBrief(propertyId!, briefId!, patch)
    if (!updated) return NextResponse.json({ error: "Brief not found" }, { status: 404 })
    return NextResponse.json({ data: updated })
  },
)

// DELETE - remove a brief.
export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId, briefId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const ok = await deleteBrief(propertyId!, briefId!)
    if (!ok) return NextResponse.json({ error: "Brief not found" }, { status: 404 })
    return NextResponse.json({ data: { deleted: true } })
  },
)
