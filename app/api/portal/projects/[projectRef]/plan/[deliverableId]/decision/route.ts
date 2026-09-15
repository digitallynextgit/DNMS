import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { decideClientPlanItem } from "@/features/client-portal/server/client-plan.service"

// POST - finalise a delivered item, or send it back with a reason. The service
// asks the shared transition table, so this cannot allow a move the staff board
// would refuse.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await decideClientPlanItem(params.projectRef, params.deliverableId, await req.json())),
)
