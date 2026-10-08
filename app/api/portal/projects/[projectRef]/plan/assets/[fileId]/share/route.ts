import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { revokeClientPlanShare } from "@/features/client-portal/server/client-plan.service"

// Withdraws the public share link; the video itself stays.
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await revokeClientPlanShare(params.projectRef, params.fileId)),
)
