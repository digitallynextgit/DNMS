import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { setOwnPassword } from "@/features/auth/server/auth.service"

// POST /api/password - signed-in user sets their own password (forced change).
// The service calls requireSession(); respond() maps an auth failure to 401.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { newPassword: string }
  return respond(await setOwnPassword(body.newPassword))
})
