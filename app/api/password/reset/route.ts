import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { resetPasswordWithToken } from "@/features/auth/server/auth.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// Rate limited: an unlimited unauthenticated bcrypt endpoint is a CPU amplifier.
export const POST = withErrorHandler(async (req: NextRequest) => {
  if (rateLimited(`pwreset:ip:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }
  const body = (await req.json()) as { token: string; password: string }
  return respond(await resetPasswordWithToken(body.token, body.password))
})
