import { withClientSession, respond } from "@/server/api-handler"
import { getClientInventory } from "@/features/client-portal/server/client-portal.queries"

// GET /api/portal/projects/:projectRef/inventory
export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await getClientInventory(params.projectRef)),
)
