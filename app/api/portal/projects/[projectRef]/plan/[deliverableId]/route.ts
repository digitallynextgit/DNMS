import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientPlanItem } from "@/features/client-portal/server/client-plan.service"

// DELETE - withdraw a request the client made that nobody has started. The
// service holds the rule; it is narrow, and files on the item survive it.
export const DELETE = withClientSession(
  async (_req, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await deleteClientPlanItem(params.projectRef, params.deliverableId)),
)
