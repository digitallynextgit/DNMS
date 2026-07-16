import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { ZodError } from "zod"
import { careersApplicationSchema } from "@/features/careers/schemas/application.schema"
import { createCareerApplication } from "@/features/careers/server/careers-applications.service"

// POST /api/public/careers/applications
//
// Server-to-server ONLY: the marketing site's route handler calls this with the
// WRITE key. Deliberately different from the read API in two ways:
//
//  1. It uses CAREERS_WRITE_API_KEY, never the read key. The read key is handed
//     out for a public, cacheable job board; a key that writes applicant PII has
//     to be independently rotatable.
//  2. It sends NO CORS headers. The read route is `*` because it serves public
//     ads; a wildcard here would let any browser (with a key it could see) write
//     to the applicant table. No browser use case exists, so no browser access.
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

// ─── Rate limiting ──────────────────────────────────────────────────────────
// In-memory sliding window. The site says it limits 10/min/IP, but we don't
// trust an upstream we don't control. Per-IP stops floods; per-email stops one
// person hammering submit.
const IP_LIMIT = 20
const EMAIL_LIMIT = 5
const WINDOW_MS = 60_000
const hits = new Map<string, number[]>()

function tooMany(key: string, limit: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  // Opportunistic cleanup so the map can't grow unbounded.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return recent.length > limit
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  return (fwd ? fwd.split(",")[0]!.trim() : null) || req.headers.get("x-real-ip") || "unknown"
}

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
  if (tooMany(`ip:${ip}`, IP_LIMIT)) {
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

  if (tooMany(`email:${input.applicant.email}`, EMAIL_LIMIT)) {
    return fail("RATE_LIMITED", "Too many requests. Try again shortly.", 429)
  }

  try {
    const result = await createCareerApplication(input)
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
