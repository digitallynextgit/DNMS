import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { updateClientContact } from "@/features/client-portal/server/client-contacts.service"

// PATCH /api/clients/[id]/contacts/[contactId] - name, phone, or login on/off
export const PATCH = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(
      await updateClientContact(
        params.id!,
        params.contactId!,
        await req.json().catch(() => ({})),
        session,
      ),
    ),
)
