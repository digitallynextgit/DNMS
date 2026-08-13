import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { getSetupState } from "@/features/seo/server/seo.setup.service"
import { resolveProjectId } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"

// GET - the guided setup checklist for this site: which steps are done, what
// each unlocks, and which scorecard points are still locked behind config.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    const { propertyId } = ctx.params
    // The URL carries a slug now, and plain withAuth doesn't resolve one. The
    // ownership check below matches against the stored projectId, so it needs
    // the real id.
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
