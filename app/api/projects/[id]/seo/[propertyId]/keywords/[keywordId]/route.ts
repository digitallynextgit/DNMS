import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { z } from "zod"
import { withProjectManager } from "@/features/projects/server/project-access"
import { updateKeyword } from "@/features/seo/server/seo.keywords.service"
import type { Session } from "next-auth"

const patchSchema = z.object({
  winnable: z.boolean().nullable().optional(),
  businessValue: z.number().int().min(1).max(5).optional(),
  intent: z.enum(["commercial", "informational", "branded", "navigational", "other"]).optional(),
  status: z.enum(["BACKLOG", "IN_PROGRESS", "PUBLISHED", "PARKED"]).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// propertyId is client-supplied and the updates scope by it alone, so check it belongs to THIS
// project (or a manager of A could edit B's keywords).
async function propertyInProject(projectId: string, propertyId: string): Promise<boolean> {
  const owned = await db.seoProperty.findFirst({
    where: { id: propertyId, projectId },
    select: { id: true },
  })
  return !!owned
}

export const PATCH = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id: projectId, propertyId, keywordId } = ctx.params
    if (!(await propertyInProject(projectId!, propertyId!))) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 })
    }
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 422 },
      )
    }
    const ok = await updateKeyword(propertyId!, keywordId!, parsed.data)
    if (!ok) return NextResponse.json({ error: "Keyword not found" }, { status: 404 })
    return NextResponse.json({ data: { ok: true } })
  },
)

export const DELETE = withProjectManager(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id: projectId, propertyId, keywordId } = ctx.params
    if (!(await propertyInProject(projectId!, propertyId!))) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 })
    }
    const kw = await db.seoKeyword.findFirst({
      where: { id: keywordId, propertyId },
      select: { id: true },
    })
    if (!kw) return NextResponse.json({ error: "Keyword not found" }, { status: 404 })
    await db.seoKeyword.delete({ where: { id: kw.id } })
    return NextResponse.json({ data: { deleted: true } })
  },
)
