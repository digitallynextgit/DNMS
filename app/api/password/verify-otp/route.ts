import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { verifyPasswordOtp } from "@/features/auth/server/auth.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// Rate limited per IP: the per-record lock doesn't stop spraying attempts across many emails.
export const POST = withErrorHandler(async (req: NextRequest) => {
  if (rateLimited(`pwverify:ip:${clientIp(req)}`, 15, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }
  const body = (await req.json()) as { email: string; otp: string }
  return respond(await verifyPasswordOtp(body.email, body.otp))
})
