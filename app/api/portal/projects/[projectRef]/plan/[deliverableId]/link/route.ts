import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { attachClientPlanLink } from "@/features/client-portal/server/client-plan.service"

export const POST = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; deliverableId: string } }) =>
    respond(await attachClientPlanLink(params.projectRef, params.deliverableId, await req.json())),
)
