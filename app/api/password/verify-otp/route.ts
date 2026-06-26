import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { verifyPasswordOtp } from "@/features/auth/server/auth.service"

// POST /api/password/verify-otp - verify the code, return the reset token.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { email: string; otp: string }
  return respond(await verifyPasswordOtp(body.email, body.otp))
})
