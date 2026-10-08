import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  getClientPlanAssetUrl,
  deleteClientPlanAsset,
} from "@/features/client-portal/server/client-plan.service"

// "assets" is a static segment beside [deliverableId]; Next resolves static first, so they can't clash.
export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(
      await getClientPlanAssetUrl(params.projectRef, params.fileId, {
        download: new URL(req.url).searchParams.get("download") === "1",
      }),
    ),
)

// Only the client's own uploads; the service answers 404 for anyone else's.
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await deleteClientPlanAsset(params.projectRef, params.fileId)),
)
