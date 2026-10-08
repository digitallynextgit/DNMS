import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { setClientPlanStatus } from "@/features/client-portal/server/client-plan.service"

// Clients track progress; the verdict states stay with the staff side.
export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await setClientPlanStatus(params.projectRef, params.deliverableId, await req.json())),
)
