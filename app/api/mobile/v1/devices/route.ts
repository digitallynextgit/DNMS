import type { NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/server/db"
import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { runUnscoped } from "@/server/tenant-context"
import {
  resolveMobilePrincipal,
  runAsMobilePrincipal,
  type MobilePrincipal,
} from "@/server/mobile-auth"
import { readJsonBody, throttled } from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST   /api/mobile/v1/devices   register this handset's FCM / APNs token
// DELETE /api/mobile/v1/devices   release it (sign-out, or push turned off)
//
// WHY THIS ROUTE EXISTS AT ALL - /api/notifications/push CANNOT be reused. That
// route validates the subscription's `endpoint` as an https URL on a four-host
// browser-vendor allow-list (isKnownPushEndpoint(), route.ts:9-28) and requires
// the VAPID pair keys.p256dh + keys.auth (route.ts:42-47). An FCM registration
// token is not a URL, and an APNs device token is 64 hex characters - both fail
// those checks outright. On top of that the `origin` column added by 3a97508 is
// read from the Origin/Referer header, which a native client never sends, so
// isPushDeliverable(null, prodOrigin) would drop every mobile push even if a
// token could be submitted. Hence a separate table and this route; the sender is
// lib/push-mobile.ts.
//
// SELF-AUTHENTICATING, because it has to be. /api/mobile is a PUBLIC_PREFIXES
// entry in proxy.ts - the proxy waves the whole namespace through and every file
// under it answers for its own caller. resolveMobilePrincipal() is the first
// thing both handlers do, and `null` is 401. A file added here that skips it is
// an open endpoint, which is why app/api/mobile/mobile-surface.test.ts asserts
// the exact file set.
//
// NO mustChangePassword FENCE HERE, unlike the dispatcher - and that is
// deliberate, not an oversight. mustChangePassword is set when HR creates an
// account, so the people it applies to are precisely the ones on their FIRST
// launch, which is the only launch on which the app registers a token. Fencing
// this route would silently cost every new joiner push for the life of the
// install. It is safe to leave open because the write carries no employee data
// in either direction: it stores an opaque vendor token against the caller's own
// id and returns nothing but an acknowledgement.
// -----------------------------------------------------------------------------

// Prisma, so never the Edge. Route handlers already default to Node, but this
// one is stated because the whole mobile design rests on it.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Registration bodies come from a handset, so every string is bounded. The
 * platform enum is the same pair server/mobile-auth.ts accepts, and it matters
 * twice over: lib/push-mobile.ts routes FCM vs APNs off this value, so a third
 * value would be a row that can never receive a push.
 */
const Registration = z.object({
  // FCM tokens run to ~200 characters, APNs device tokens are 64 hex; the floor
  // only rejects an empty-ish string, the ceiling a hostile one.
  token: z.string().trim().min(10).max(4096),
  platform: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(["ios", "android"])),
  appVersion: z.string().trim().max(40).nullish(),
})

/** 20 registrations per 5 minutes per session - a relaunch loop, not a user. */
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 5 * 60 * 1000

/** The verified caller, or the response to return instead. */
async function gate(req: NextRequest): Promise<MobilePrincipal | Response> {
  const principal = await resolveMobilePrincipal(req)
  if (!principal) {
    // Same code and wording as the dispatcher's 401, so the app's single
    // refresh-and-retry path recognises it without a second branch.
    return fail("UNAUTHORIZED", "A valid DNMS mobile access token is required", 401)
  }
  // Keyed on the SESSION, not the IP: one office sits behind one public IP, so a
  // per-IP bucket here would be a per-company bucket - the note on ipThrottled()
  // in features/auth/server/mobile-auth-http.ts. A caller has already proved it
  // holds an access token to get this far, so the session is the right subject.
  // throttled() rather than a bare rateLimited() because it carries Retry-After,
  // which the app's backoff reads.
  const limited = throttled(
    `mobile:devices:session:${principal.sessionId}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  )
  if (limited) return limited
  return principal
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const caller = await gate(req)
  if (caller instanceof Response) return caller

  // ZodError -> 422 VALIDATION_ERROR with a readable sentence, through the
  // withErrorHandler funnel. readJsonBody() hands zod {} for a missing or
  // malformed body, so the answer is "Token is required" rather than a 500.
  const body = Registration.parse(await readJsonBody(req))
  const now = new Date()
  // `||`, not `??`: a trimmed-to-empty string is no version either. The session's
  // own appVersion is the fallback, since the sign-in that minted it carried one.
  const appVersion = body.appVersion || caller.appVersion

  // -------------------------------------------------------------------------
  // UNSCOPED ON PURPOSE, with the reason copied from the Web Push route: one
  // handset can hold two companies' employees, and device_tokens.token is a
  // GLOBAL unique index (the migration header says why). A tenant-scoped write
  // would not see the other company's row, would try to insert, and would hit
  // P2002 on an index it cannot even read.
  //
  // An upsert rather than that route's deleteMany-then-create because unscoped
  // it is legal: the guard neither narrows the WHERE nor stamps the row
  // (tenant-guard.ts:111), so `where: {token}` genuinely matches any tenant's
  // row - and one statement has no window in which two launches both insert.
  // The price of unscoped is the other half of the same rule: this write names
  // tenantId itself. Forgetting it is a NOT NULL violation, not a row quietly
  // filed under the founding tenant.
  //
  // disabledAt: null is the revival. lib/push-mobile.ts disables a token on FCM
  // UNREGISTERED / APNs 410; a re-registration of that same token is the device
  // saying it is back, and without this line it would never be pushed to again.
  // -------------------------------------------------------------------------
  await runUnscoped(
    "push token is device-global: re-pointing it to the signing-in user must cross tenants",
    () =>
      db.deviceToken.upsert({
        where: { token: body.token },
        create: {
          tenantId: caller.tenantId,
          employeeId: caller.employeeId,
          token: body.token,
          platform: body.platform,
          appVersion,
          lastSeenAt: now,
        },
        update: {
          tenantId: caller.tenantId,
          employeeId: caller.employeeId,
          platform: body.platform,
          appVersion,
          lastSeenAt: now,
          disabledAt: null,
        },
      }),
  )

  // The app reads nothing off this body (dnmsApp src/features/push/push.api.ts
  // says why), so it stays an acknowledgement - never a copy of the token.
  return ok({ ok: true })
})

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const caller = await gate(req)
  if (caller instanceof Response) return caller

  // The app sends a JSON body (api.delete puts its second argument there);
  // ?token= is accepted too, because that is what a curl or a browser reaches
  // for and the Web Push route's DELETE established it.
  const body = (await readJsonBody(req)) as { token?: unknown }
  const fromBody = typeof body?.token === "string" ? body.token.trim() : ""
  const token = fromBody || (req.nextUrl.searchParams.get("token")?.trim() ?? "")
  if (!token) return fail("BAD_REQUEST", "token is required", 400)

  // SCOPED and employee-filtered, exactly like the Web Push DELETE: holding a
  // device token must not let one signed-in employee unregister another's phone.
  // The cost is honest - if this handset has since been re-pointed at another
  // company's employee, removed is 0 and the row stays theirs.
  const { count } = await runAsMobilePrincipal(caller, () =>
    db.deviceToken.deleteMany({ where: { token, employeeId: caller.employeeId } }),
  )

  return ok({ ok: true, removed: count })
})
