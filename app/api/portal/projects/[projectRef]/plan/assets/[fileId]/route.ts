import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import {
  getClientPlanAssetUrl,
  deleteClientPlanAsset,
} from "@/features/client-portal/server/client-plan.service"

// GET - a signed URL for one asset on a plan item. `?download=1` asks for it as
// an attachment rather than inline.
//
// "assets" is a static segment sitting beside the dynamic [deliverableId], and
// Next resolves static first - so this can never be mistaken for an item id.
export const GET = withClientSession(
  async (req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(
      await getClientPlanAssetUrl(params.projectRef, params.fileId, {
        download: new URL(req.url).searchParams.get("download") === "1",
      }),
    ),
)

// DELETE - remove an asset the client attached to a plan item. Their OWN uploads
// only; the service decides, and answers 404 for anyone else's.
export const DELETE = withClientSession(
  async (_req: NextRequest, { params }: { params: { projectRef: string; fileId: string } }) =>
    respond(await deleteClientPlanAsset(params.projectRef, params.fileId)),
)
