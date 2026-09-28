import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { verifyPasswordOtp } from "@/features/auth/server/auth.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// POST /api/password/verify-otp - verify the code, return the reset token.
//
// Rate limited per IP: the per-record 5-attempt lock already bounds guessing
// one person's code, but nothing stopped an IP from spraying attempts across
// many emails (or burning a target's 5 attempts on purpose, over and over).
export const POST = withErrorHandler(async (req: NextRequest) => {
  if (rateLimited(`pwverify:ip:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }
  const body = (await req.json()) as { email: string; otp: string }
  return respond(await verifyPasswordOtp(body.email, body.otp))
})
