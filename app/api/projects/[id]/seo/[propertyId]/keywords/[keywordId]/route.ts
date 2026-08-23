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

/**
 * Prove the property is tracked under THIS project before touching its keywords.
 * withProjectManager only validated the URL project; propertyId/keywordId are
 * client-supplied, and updateKeyword/delete scope by propertyId alone - so
 * without this a manager of project A could edit project B's keywords by pairing
 * A's id with B's propertyId. Mirrors the owned() guard in the sibling route.
 */
async function propertyInProject(projectId: string, propertyId: string): Promise<boolean> {
  const owned = await db.seoProperty.findFirst({
    where: { id: propertyId, projectId },
    select: { id: true },
  })
  return !!owned
}

// PATCH - update a keyword's human fields (winnable / value / intent / status).
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

// DELETE - drop a keyword from the backlog.
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
