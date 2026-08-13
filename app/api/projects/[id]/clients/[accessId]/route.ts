import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  updateProjectClient,
  removeProjectClient,
} from "@/features/client-portal/server/client-admin.service"

// PATCH  /api/projects/:id/clients/:accessId - change sections / pause
// DELETE /api/projects/:id/clients/:accessId - remove from this project
export const PATCH = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await updateProjectClient(params.id, params.accessId, await req.json(), session)),
)

export const DELETE = withProjectManager(async (_req, { params }, session) =>
  respond(await removeProjectClient(params.id, params.accessId, session)),
)
