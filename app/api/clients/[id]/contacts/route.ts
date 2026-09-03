import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { createClientContact } from "@/features/client-portal/server/client-contacts.service"

// POST /api/clients/[id]/contacts - give someone at this client a portal login
export const POST = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(
      await createClientContact(params.id!, await req.json().catch(() => ({})), session),
      201,
    ),
)
