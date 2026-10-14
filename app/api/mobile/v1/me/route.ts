import type { NextRequest } from "next/server"
import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { ipThrottled, throttled } from "@/features/auth/server/mobile-auth-http"
import { mobileUserFrom, resolveMobilePrincipal } from "@/server/mobile-auth"

// -----------------------------------------------------------------------------
// GET /api/mobile/v1/me - who is holding this access token, right now.
//
// The app calls this on EVERY launch (bootstrap(), dnmsApp auth-store.ts) and it
// is the only endpoint that tells a phone who it is: /api/profile carries no
// roles, no permissions and no tenant.
//
// WHY IT READS FRESH AND WHY THAT COSTS NOTHING EXTRA.
// The mobile access token is opaque - 32 random bytes behind `dnms_mt_`, stored
// only as a SHA-256 hash. It has NO claims, so there is nothing on it to be
// stale and nothing on it to trust. resolveMobilePrincipal() therefore re-reads,
// on every single request:
//   - loadMembershipIfStillValid(session.membershipId) -> the live membership
//     row, which is where mustChangePassword lives;
//   - getUserWithPermissions(employeeId) -> employee_roles joined through
//     role_permissions, i.e. the whole role and permission set from the database.
// (server/mobile-auth.ts: see the "NOTHING HERE IS CACHED" banner, and
// sessionFor() at :244.) So by the time this handler has a principal, the fresh
// read has ALREADY happened - and that is the point of this route existing: a
// role granted this morning and a mustChangePassword cleared on the web both
// reach the phone on its next launch without a re-login.
//
// Which is also why this handler adds NOT ONE query of its own. mobileUserFrom()
// is pure (server/mobile-auth.ts:602 - "Pure - no queries"): it projects the
// delegated session that the fresh read just built into the MobileUser shape the
// app's `MeResponse` expects. Re-reading the employee here would be a second
// round trip for bytes we are already holding, on the one call that sits in
// front of the launch screen. Do not "improve" this into a db.employee lookup,
// and do not reach for anything cached on the principal either - there is no
// such thing; the principal IS the fresh read.
//
// NO mustChangePassword FENCE, unlike the dispatcher
// (app/api/mobile/v1/dnms/[...path]/route.ts, which 403s PASSWORD_CHANGE_REQUIRED).
// This route is how the app LEARNS the flag is set: _layout.tsx redirects to
// /change-password off `user.mustChangePassword`, which it reads out of this
// body. Fencing it would mean the app could never find out why it was fenced -
// a signed-in user staring at a launch screen that cannot explain itself. The
// flag is carried, honestly, in the payload; POST /api/mobile/v1/password is the
// way out and is deliberately unfenced for the same reason.
//
// SELF-AUTHENTICATING, because "/api/mobile" is a PUBLIC_PREFIXES entry in
// proxy.ts: the Edge waves this whole namespace through with no session check
// (an opaque token can only be verified where there is a database, and the Edge
// is not that place). resolveMobilePrincipal() is the first real act of this
// handler and `null` is a 401. app/api/mobile/mobile-surface.test.ts asserts
// exactly that, by name, for every file under this directory.
// -----------------------------------------------------------------------------

/** Prisma and sha256Hex. The whole mobile design rests on this not being the Edge. */
export const runtime = "nodejs"

/** One person's live grants, per request. Nothing here is ever cacheable. */
export const dynamic = "force-dynamic"

const WINDOW_MS = 60_000

/**
 * Per IP, pre-auth: the only thing between an anonymous flood and one database
 * token lookup. The same 600/min the dispatcher uses, and loose for the same
 * reason - one office of staff sits behind ONE public IP, so a per-IP bucket is
 * really a per-company bucket and 50 phones waking up on the same Wi-Fi at 9am
 * are 50 hits. (Worse: if nginx sends neither x-real-ip nor x-forwarded-for,
 * clientIp() returns "unknown" and every caller worldwide shares this bucket -
 * lib/rate-limit.ts:25-31.)
 */
const PER_IP_PER_MIN = 600

/**
 * Per session. A launch spends ONE call here, so 60/min is not traffic shaping -
 * it is the ceiling on a relaunch or retry loop. Keyed on the SESSION and not on
 * the token, because the token rotates every 15 minutes and a token-keyed bucket
 * would reset itself and limit nothing over a long run.
 */
const PER_SESSION_PER_MIN = 60

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Cheapest gate first, and before the token lookup, so an anonymous flood
  // costs no database work. throttled() rather than a bare rateLimited()
  // because it carries the Retry-After the app's backoff reads.
  const flooding = ipThrottled(req, "me", PER_IP_PER_MIN, WINDOW_MS)
  if (flooding) return flooding

  const principal = await resolveMobilePrincipal(req)
  if (!principal) {
    // Same code and wording as the dispatcher's and /devices' 401, so the app's
    // single refresh-and-retry path recognises it without a second branch.
    return fail("UNAUTHORIZED", "A valid DNMS mobile access token is required", 401)
  }

  const busy = throttled(`mobile:me:session:${principal.sessionId}`, PER_SESSION_PER_MIN, WINDOW_MS)
  if (busy) return busy

  // `{ user }` and not the bare user: the app reads res.data.user (MeResponse,
  // dnmsApp src/features/auth/types.ts:50-53), and the extra level leaves room
  // for a sibling key later without a breaking change to a shipped build.
  return ok({ user: mobileUserFrom(principal.session) })
})
