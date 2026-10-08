import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { updateAsset, deleteAsset } from "@/features/monitoring/server/monitoring.service"

// A later expiry resets the reminders.
export const PATCH = withProjectAccess(async (req: NextRequest, { params }, session) =>
  respond(await updateAsset(params.id, params.assetId, await req.json(), session)),
)

export const DELETE = withProjectAccess(async (_req, { params }, session) =>
  respond(await deleteAsset(params.id, params.assetId, session)),
)
