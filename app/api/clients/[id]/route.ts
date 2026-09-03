import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { getClient } from "@/features/clients/server/clients.queries"
import { updateClient, deleteClient } from "@/features/clients/server/clients.service"

// GET    /api/clients/[id] - one client with its projects, people and grants
// PATCH  /api/clients/[id] - edit the company
// DELETE /api/clients/[id] - remove it (refused while anything hangs off it)
//
// withClient resolves the slug-or-id in the URL to a real client id and 404s
// first, so the services can trust ctx.params.id.
export const GET = withClient(PERMISSIONS.CLIENT_READ, async (_req, { params }) =>
  respond(await getClient(params.id!)),
)

export const PATCH = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(await updateClient(params.id!, await req.json().catch(() => ({})), session)),
)

export const DELETE = withClient(PERMISSIONS.CLIENT_WRITE, async (_req, { params }, session) =>
  respond(await deleteClient(params.id!, session)),
)
