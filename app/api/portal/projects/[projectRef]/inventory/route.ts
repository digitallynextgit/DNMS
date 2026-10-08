import { withClientSession, respond } from "@/server/api-handler"
import { getClientInventory } from "@/features/client-portal/server/client-portal.queries"

export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await getClientInventory(params.projectRef)),
)
