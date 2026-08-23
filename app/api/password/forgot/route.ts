import { NextRequest, NextResponse } from "next/server"
import { withErrorHandler, respond } from "@/server/api-handler"
import { requestPasswordOtp } from "@/features/auth/server/auth.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// POST /api/password/forgot - email a 6-digit reset code to an active employee.
//
// Rate limited per IP AND per email (SEC-05): without it this endpoint is an
// email bomb (unbounded reset mails burning the shared SMTP quota) and a fast
// account-enumeration oracle (the response distinguishes "no account"). The
// limiter returns 429 before requestPasswordOtp does any DB lookup or send.
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
