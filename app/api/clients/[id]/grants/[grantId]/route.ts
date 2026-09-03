import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import {
  updateClientGrant,
  revokeClientGrant,
} from "@/features/client-portal/server/client-contacts.service"

// PATCH  /api/clients/[id]/grants/[grantId] - change sections, or pause / resume
// DELETE /api/clients/[id]/grants/[grantId] - take the project away
export const PATCH = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(
      await updateClientGrant(
        params.id!,
        params.grantId!,
        await req.json().catch(() => ({})),
        session,
      ),
    ),
)

export const DELETE = withClient(PERMISSIONS.CLIENT_WRITE, async (_req, { params }, session) =>
  respond(await revokeClientGrant(params.id!, params.grantId!, session)),
)
