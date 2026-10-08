import { withClientSession, respond } from "@/server/api-handler"
import { listClientChannels } from "@/features/client-portal/server/client-portal.queries"

export const GET = withClientSession(async (_req, { params }: { params: { projectRef: string } }) =>
  respond(await listClientChannels(params.projectRef)),
)
