import { NextRequest } from "next/server"
import { withClientSession, respond } from "@/server/api-handler"
import { changeClientPassword } from "@/features/client-portal/server/client-account.service"

// proxy.ts allows this while the must-change-password gate is active.
export const POST = withClientSession(async (req: NextRequest) =>
  respond(await changeClientPassword(await req.json())),
)
