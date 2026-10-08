import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { requestPasswordOtp } from "@/features/auth/server/auth.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// Rate limited per IP and per email; otherwise it is an email bomb and an account-enumeration oracle.
const IP_LIMIT = 10
const EMAIL_LIMIT = 3
const WINDOW_MS = 60_000

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = (await req.json()) as { email?: string }
  const email = (body.email ?? "").toLowerCase().trim()

  const ip = clientIp(req)
  if (rateLimited(`pwforgot:ip:${ip}`, IP_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }
  if (email && rateLimited(`pwforgot:email:${email}`, EMAIL_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }

  return respond(await requestPasswordOtp(email))
})
