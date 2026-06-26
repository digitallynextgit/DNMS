import { NextRequest } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { requestPasswordOtp } from "@/features/auth/server/auth.service"

// POST /api/password/forgot - email a 6-digit reset code to an active employee.
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { email: string }
  return respond(await requestPasswordOtp(body.email))
})
