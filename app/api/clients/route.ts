import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { withAuth, respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { listClients } from "@/features/clients/server/clients.queries"
import { createClient } from "@/features/clients/server/clients.service"

// GET  /api/clients - the directory (search, status, ownerId, page, limit)
// POST /api/clients - add a client
//
// Gated on the client scopes, not project:*: running projects and keeping the
// company book are different jobs, and a role can hold one without the other.
export const GET = withAuth(PERMISSIONS.CLIENT_READ, async (req: NextRequest) =>
  respond(await listClients(Object.fromEntries(req.nextUrl.searchParams))),
)

export const POST = withAuth(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, _ctx: unknown, session: Session) =>
    respond(await createClient(await req.json().catch(() => ({})), session), 201),
)
