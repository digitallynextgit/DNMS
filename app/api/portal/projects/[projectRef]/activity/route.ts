import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { listClientActivity } from "@/features/client-portal/server/client-portal.queries"

// GET /api/portal/projects/:projectRef/activity
// The query re-proves the grant and the "activity" module; the ref in the URL is
// a lookup key, never an authorisation.
export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string } }) => {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 100)
    return respond(
      await listClientActivity(params.projectRef, Number.isFinite(limit) ? limit : 100),
    )
  },
)
