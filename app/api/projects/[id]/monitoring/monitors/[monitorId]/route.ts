import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import { updateMonitor, deleteMonitor } from "@/features/monitoring/server/monitoring.service"

export const PATCH = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await updateMonitor(params.id, params.monitorId, await req.json(), session)),
)

export const DELETE = withProjectManager(async (_req, { params }, session) =>
  respond(await deleteMonitor(params.id, params.monitorId, session)),
)
