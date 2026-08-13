import { NextRequest } from "next/server"
import { respond } from "@/server/api-handler"
import { withProjectManager } from "@/features/projects/server/project-access"
import {
  listProjectClients,
  addProjectClient,
} from "@/features/client-portal/server/client-admin.service"

// GET  /api/projects/:id/clients - who can see this project
// POST /api/projects/:id/clients - add a client to it
//
// withProjectManager resolves the slug-or-id in the URL to a real project id and
// proves the caller may manage it (project:write, or the Account Manager), so
// the services below can trust `ctx.params.id`.
export const GET = withProjectManager(async (_req, { params }) =>
  respond(await listProjectClients(params.id)),
)

export const POST = withProjectManager(async (req: NextRequest, { params }, session) =>
  respond(await addProjectClient(params.id, await req.json(), session), 201),
)
