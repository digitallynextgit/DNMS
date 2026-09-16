import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { setClientPlanStatus } from "@/features/client-portal/server/client-plan.service"

// POST - move one item to another state (to do / in progress / made / stuck /
// discarded). Replaces the old `/decision` route, which only offered finalise
// and request-changes: the portal tracks where work has got to rather than
// passing a verdict on it, and the verdict states stayed with the staff side.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await setClientPlanStatus(params.projectRef, params.deliverableId, await req.json())),
)
