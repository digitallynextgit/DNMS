import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import { respond } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { withClient } from "@/features/clients/server/client-access"
import { grantClientProject } from "@/features/client-portal/server/client-contacts.service"

export const POST = withClient(
  PERMISSIONS.CLIENT_WRITE,
  async (req: NextRequest, { params }, session: Session) =>
    respond(await grantClientProject(params.id!, await req.json().catch(() => ({})), session), 201),
)
