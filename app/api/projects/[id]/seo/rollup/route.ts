import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { getSeoRollup } from "@/features/seo/server/seo.queries"
import { resolveProjectId } from "@/features/projects/server/project-access"
import { PERMISSIONS } from "@/lib/constants"

// GET - combined numbers across every site on the project, plus a per-site row
// and the actionable alerts tagged with the site they came from.
export const GET = withAuth(
  PERMISSIONS.PROJECT_READ,
  async (_req: NextRequest, ctx: { params: Record<string, string> }) => {
    // Not wrapped in withProjectAccess, so the slug has to be resolved here.
    const projectId = await resolveProjectId(ctx.params.id!)
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    return NextResponse.json({ data: await getSeoRollup(projectId) })
  },
)
