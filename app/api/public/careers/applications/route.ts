import { NextRequest, NextResponse } from "next/server"
import { inPublicApiTenant } from "@/server/public-api"
import { timingSafeEqual } from "node:crypto"
import { ZodError } from "zod"
import { careersApplicationSchema } from "@/features/careers/schemas/application.schema"
import { createCareerApplication } from "@/features/careers/server/careers-applications.service"
import { rateLimited, clientIp } from "@/lib/rate-limit"

// Server-to-server only (the marketing site). Uses its own CAREERS_WRITE_API_KEY so it rotates
// independently of the read key, and sends no CORS headers - no browser should write applicant PII.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Constant-time compare - no early exit that leaks the key prefix by timing. */
function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, so compare lengths separately -
  // that only leaks the length, not the content.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Per-IP stops floods; per-email stops one person hammering submit.
const IP_LIMIT = 20
const EMAIL_LIMIT = 5
const WINDOW_MS = 60_000

const fail = (code: string, message: string, status: number, extra?: object) =>
  NextResponse.json({ error: { code, message, ...(extra ?? {}) } }, { status })

export async function POST(req: NextRequest) {
  const expected = process.env.CAREERS_WRITE_API_KEY
  if (!expected) {
    console.error("[careers-applications] CAREERS_WRITE_API_KEY is not configured")
    return fail("SERVER_MISCONFIGURED", "Applications are not accepted right now.", 500)
  }

  // Same 401 for missing and wrong - never hint which.
  const provided = req.headers.get("x-api-key")
  if (!provided || !keyMatches(provided, expected)) {
    return fail("UNAUTHORIZED", "Unauthorized", 401)
  }

  const ip = clientIp(req)
  if (rateLimited(`careers-apply:ip:${ip}`, IP_LIMIT, WINDOW_MS)) {
    return fail("RATE_LIMITED", "Too many requests. Try again shortly.", 429)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail("BAD_REQUEST", "Body must be valid JSON.", 400)
  }

  const parsed = careersApplicationSchema.safeParse(body)
  if (!parsed.success) {
    const err: ZodError = parsed.error
    // Field paths + messages only - never echo the applicant's values back.
    return fail("VALIDATION_FAILED", "Some fields are invalid.", 422, {
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    })
  }
  const input = parsed.data

  if (rateLimited(`careers-apply:email:${input.applicant.email}`, EMAIL_LIMIT, WINDOW_MS)) {
    return fail("RATE_LIMITED", "Too many requests. Try again shortly.", 429)
  }

  try {
    // The verified key identifies the company this careers site belongs to.
    const result = await inPublicApiTenant(() => createCareerApplication(input))
    // 200 on an idempotent replay, 201 on a newly stored application.
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    // Log the failure WITHOUT the payload - it is applicant PII.
    console.error("[careers-applications] store failed:", {
      idempotencyKey: input.idempotencyKey,
      roleSlug: input.roleId,
      error: error instanceof Error ? error.message : String(error),
    })
    return fail("SERVER_ERROR", "Could not store the application.", 500)
  }
}
