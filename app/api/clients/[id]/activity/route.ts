import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { listClientActivity } from "@/features/clients/server/clients.queries"

// GET /api/clients/[id]/activity - what this client's people did in the portal
export const GET = withClient(PERMISSIONS.CLIENT_READ, async (req: NextRequest, { params }) =>
  respond(
    await listClientActivity(params.id!, {
      page: req.nextUrl.searchParams.get("page"),
      limit: req.nextUrl.searchParams.get("limit"),
    }),
  ),
)
