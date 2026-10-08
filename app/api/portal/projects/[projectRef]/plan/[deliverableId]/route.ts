import { withClientSession, respond } from "@/server/api-handler"
import { deleteClientPlanItem } from "@/features/client-portal/server/client-plan.service"

// Only an unstarted request the client made (the service holds the rule); files on the item survive.
export const DELETE = withClientSession(
  async (_req, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await deleteClientPlanItem(params.projectRef, params.deliverableId)),
)
