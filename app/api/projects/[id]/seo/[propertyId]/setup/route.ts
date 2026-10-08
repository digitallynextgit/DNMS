import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { getSetupState } from "@/features/seo/server/seo.setup.service"
import { resolveProjectId } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"

export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { propertyId } = ctx.params
    // Plain withAuth doesn't resolve the slug, and the ownership check below needs the real id.
    const id = await resolveProjectId(ctx.params.id)
    if (!id) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const owned = await db.seoProperty.findFirst({
      where: { id: propertyId, projectId: id },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: "Site not found" }, { status: 404 })
    return NextResponse.json({ data: await getSetupState(propertyId!) })
  },
)
