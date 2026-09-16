import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { revokeClientPlanShare } from "@/features/client-portal/server/client-plan.service"

// DELETE - withdraw a video's public share link. The video itself stays.
//
// Sits under the same static "assets" segment as the signed-url route beside it,
// so it can never be confused with a [deliverableId].
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await revokeClientPlanShare(params.projectRef, params.fileId)),
)
