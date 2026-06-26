import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { resetPasswordWithToken } from "@/features/auth/server/auth.service"

// POST /api/password/reset - set the new password using the verified token.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { token: string; password: string }
  return respond(await resetPasswordWithToken(body.token, body.password))
})
