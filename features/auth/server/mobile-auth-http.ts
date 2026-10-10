import "server-only"

import type { NextResponse } from "next/server"
import { fail } from "@/lib/api-response"
import { clientIp, rateLimited } from "@/lib/rate-limit"
import { sha256Hex } from "@/features/mcp/server/tokens"
import {
  MobileAuthError,
  type IssuedMobileSession,
  type MobileDeviceInput,
} from "@/server/mobile-auth"
import type { MobileDeviceBody } from "@/features/auth/schemas/mobile-auth.schema"

// -----------------------------------------------------------------------------
// Wire-format helpers shared by the five self-authenticating mobile auth routes
// (auth/login, auth/google, auth/refresh, auth/logout, password).
//
// The equivalent of features/mcp/server/http.ts for the AI connector, and it
// exists for the same reason: five copies of an error mapping is five chances to
// get one wrong, and these are the routes where getting it wrong signs a user out
// or - worse - does NOT sign them out.
//
// They all run under withErrorHandler (server/api-handler.ts:145), which already
// gives the house envelope, the ZodError -> 422 funnel and the 500 catch-all.
// What it does NOT know about is MobileAuthError, so mobileAuthFailure() below is
// the one mapping every route must use.
// -----------------------------------------------------------------------------

/**
 * MobileAuthError -> {success:false,error:{code,message}} at its own status.
 *
 * Anything else is RETHROWN, on purpose: withErrorHandler's funnel turns a
 * ZodError into a 422 and an unknown throw into a logged 500. Swallowing here
 * would answer 401 for a database outage, and the app reads a coded 401 on the
 * refresh route as a verdict on the token - it would sign the user out over a
 * dropped connection (classifyRefreshFailure, dnmsApp/src/lib/api-contract.ts).
 */
export function mobileAuthFailure(err: unknown): NextResponse {
  if (err instanceof MobileAuthError) return fail(err.code, err.message, err.status)
  throw err
}

/**
 * 429 with a Retry-After, or null when the caller is still inside its budget.
 *
 * The header value is the WHOLE window, which is pessimistic: lib/rate-limit.ts
 * slides its window and does not report how much of it is left. That is a
 * deliberate trade - the app caps what it honours at 60s
 * (MAX_REFRESH_COOLDOWN_MS, dnmsApp/src/lib/api-client.ts) precisely because the
 * server over-reports, and a value that is too large only ever delays a retry.
 *
 * Every limit here is PER PROCESS (lib/rate-limit.ts:1-2). Behind a PM2 cluster
 * the effective limit is this number times the instance count.
 */
export function throttled(key: string, limit: number, windowMs: number): NextResponse | null {
  if (!rateLimited(key, limit, windowMs)) return null
  const res = fail("RATE_LIMITED", "Too many requests. Try again shortly.", 429)
  res.headers.set("Retry-After", String(Math.ceil(windowMs / 1000)))
  return res
}

/**
 * Per-IP guard, cheap enough to run BEFORE the body is read.
 *
 * It is not the credential throttle - authorizeWithIdentity() brings that
 * (10/email + 30/IP per 15 min, server/auth.ts:139-145) but only once it has an
 * email to key on, so a flood of junk bodies would otherwise be unlimited.
 *
 * KEEP THESE LIMITS LOOSE. One office of staff sits behind ONE public IP, so a
 * per-IP bucket is really a per-company bucket: 50 phones waking up on the same
 * Wi-Fi at 9am are 50 hits, and a number chosen as "generous for one person" is a
 * company-wide outage. The precise guards are keyed on the thing being attacked -
 * the email, the token, the session - and those are where the teeth belong.
 *
 * If nginx sends neither x-real-ip nor x-forwarded-for, clientIp() returns
 * "unknown" and EVERY caller worldwide shares one bucket (lib/rate-limit.ts:25-31),
 * which is the same failure one size larger.
 */
export function ipThrottled(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  return throttled(`mobile:${scope}:ip:${clientIp(req)}`, limit, windowMs)
}

/**
 * A rate-limit key for a presented token.
 *
 * HASHED and then TRUNCATED. Hashed because the bucket map is a long-lived
 * in-memory object and a raw token must not live in one; truncated so the key is
 * not byte-identical to mobile_tokens.token_hash, because a limiter key is not a
 * credential and must not quietly become one. 32 hex chars is 128 bits - far
 * past any collision that matters for a counter.
 */
export function tokenKey(scope: string, token: string): string {
  return `mobile:${scope}:tok:${sha256Hex(token).slice(0, 32)}`
}

/**
 * The body, or {} for an absent or malformed one.
 *
 * Tolerant on purpose: logout legitimately posts no body at all, and for the rest
 * {} lets zod write "Email is required" instead of the route answering 500 on a
 * JSON parse. The result is unknown, so it reaches zod before anything reads it.
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  return req.json().catch(() => ({}) as unknown)
}

/**
 * The `Authorization: Bearer <token>` value, for logout when the app sends no
 * refresh token. Not a verification of any kind - resolveMobilePrincipal() does
 * that, and revoke() only needs a string to hash and look up.
 */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header) return null
  const [scheme, ...rest] = header.trim().split(/\s+/)
  if (!scheme || scheme.toLowerCase() !== "bearer") return null
  return rest.join("") || null
}

/**
 * The app's device body -> the core's MobileDeviceInput.
 *
 * `fallback` carries the CURRENT session's device, for a route that mints a
 * replacement session for a handset that is already known.
 */
export function mobileDeviceInput(
  device: MobileDeviceBody | undefined,
  fallback?: { deviceId?: string | null; platform?: string | null; appVersion?: string | null },
): MobileDeviceInput {
  return {
    deviceId: device?.deviceId ?? fallback?.deviceId ?? null,
    // issueSession() owns the platform rule, so this only has to carry a string
    // through - see the note on mobileDeviceSchema.platform.
    platform: device?.platform ?? fallback?.platform ?? "",
    // The app sends `name`; `deviceName` is accepted for a future build that
    // prefers the server's own spelling.
    deviceName: device?.deviceName ?? device?.name ?? null,
    appVersion: device?.appVersion ?? fallback?.appVersion ?? null,
  }
}

/**
 * The ONE success body for every route that mints a session: login, google,
 * refresh and password. The app relies on that sameness - its refresh path reads
 * the same three fields out of the same place as its login path
 * (dnmsApp/src/features/auth/types.ts:25-48).
 *
 * Built field by field, NEVER `{...issued}`: IssuedMobileSession also carries
 * `session`, the raw mobile_sessions row, and spreading it would put tenantId,
 * membershipId and the internal session id on the wire for every sign-in.
 *
 * `tenant` is here because NO other DNMS endpoint tells a mobile client which
 * workspace it is in - /api/profile has no tenant field at all.
 */
export function issuedBody(issued: IssuedMobileSession) {
  return {
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    /** SECONDS, which is what the app stores and what expiresAt is computed from. */
    expiresIn: issued.expiresIn,
    user: issued.user,
    tenant: { slug: issued.tenantSlug, name: issued.tenantName },
  }
}
