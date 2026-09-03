import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { resetClientContactPassword } from "@/features/client-portal/server/client-contacts.service"

// POST /api/clients/[id]/contacts/[contactId]/password - issue and email a new one
export const POST = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(
      await resetClientContactPassword(
        params.id!,
        params.contactId!,
        await req.json().catch(() => ({})),
        session,
      ),
    ),
)
