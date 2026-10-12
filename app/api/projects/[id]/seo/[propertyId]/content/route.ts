import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { resolveProjectId, withProjectManager } from "@/features/projects/server/project-access"
import { createBrief, getBriefs } from "@/features/seo/server/seo.content.service"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

export const runtime = "nodejs"

// Reads use plain withAuth, so the URL segment may still be the slug; writes get it resolved.
async function owned(projectRef: string, propertyId: string) {
  const projectId = await resolveProjectId(projectRef)
  if (!projectId) return null
  return db.seoProperty.findFirst({ where: { id: propertyId, projectId }, select: { id: true } })
}

const createSchema = z
  .object({
    keywordId: z.string().min(1).optional(),
    targetQuery: z.string().trim().min(2).max(200).optional(),
  })
  .refine((v) => v.keywordId || v.targetQuery, {
    message: "Provide a keyword or a target query",
  })

export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getBriefs(propertyId!) })
  },
)

export const POST = withProjectManager(
  async (req: NextRequest, ctx: { params: Record<string, string> }, _s: Session) => {
    const { id, propertyId } = ctx.params
    if (!(await owned(id!, propertyId!)))
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    const input = createSchema.parse(await req.json())
    const brief = await createBrief(propertyId!, input)
    if (!brief) return NextResponse.json({ error: "Could not create the brief" }, { status: 400 })
    return NextResponse.json({ data: brief }, { status: 201 })
  },
)
