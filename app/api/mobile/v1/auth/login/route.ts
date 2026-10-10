import { withErrorHandler } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { authorizeWithIdentity } from "@/server/auth"
import { issueSession } from "@/server/mobile-auth"
import { mobileLoginSchema } from "@/features/auth/schemas/mobile-auth.schema"
import {
  ipThrottled,
  issuedBody,
  mobileAuthFailure,
  mobileDeviceInput,
  readJsonBody,
} from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/auth/login - email + password, from the handset.
//
// SELF-AUTHENTICATING. /api/mobile is a PUBLIC_PREFIX in proxy.ts, exactly like
// /api/mcp, so nothing in front of this file checks anything. Any new file added
// under app/api/mobile that does not authenticate itself is an open endpoint.
//
// This route is ~20 lines of decision and 0 lines of credential handling, because
// authorizeWithIdentity() (server/auth.ts:128) is the SAME function the web
// Credentials provider calls. Reusing it rather than re-checking a bcrypt hash
// here is what buys, for free:
//   - normalizeEmail(), so "A@x.com" and "a@x.com" are one account and one
//     rate-limit bucket (server/auth.ts:137);
//   - the guessing throttle, 10/email + 30/IP per 15 min, BEFORE any DB work -
//     armed ONLY when `req` is passed, which is why it is passed (auth.ts:139-145);
//   - the bcrypt compare and the transitional adoptLegacyLogin path;
//   - loadActiveMemberships(), which is the gate that makes a suspended tenant, a
//     READ_ONLY tenant, a lapsed TRIAL, a deactivated employee and a revoked
//     membership all unable to sign in (server/identity.ts:61-107).
// A second implementation of any of those would be a second place to get it wrong.
//
// INACTIVE MEMBERSHIPS are therefore refused twice before a token exists:
// loadActiveMemberships() filters on memberships.is_active (there is no `status`
// column) plus the user, tenant and profile switches, and issueSession() then
// re-reads the row through loadMembershipIfStillValid(). Neither check is
// duplicated here - a third copy would only be a third thing to forget.
//
// NOTHING in this file logs. The body holds a plaintext password and the response
// holds two bearer tokens; there is no log line worth either of them.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  // Above the credential throttle on purpose: that one needs an email to key on,
  // so it cannot see a flood of bodies that never parse. Loose, because one
  // office is one IP - authorizeWithIdentity's own 30/IP per 15 min binds long
  // before this does, so this only ever catches traffic that never reached it.
  const flooding = ipThrottled(req, "login", 240, 15 * 60_000)
  if (flooding) return flooding

  const body = mobileLoginSchema.parse(await readJsonBody(req))

  const identity = await authorizeWithIdentity(body.email, body.password, "STAFF", req)

  // ONE answer for four different facts - wrong password, no such account, no
  // live membership in any company, and throttled. That is deliberate upstream
  // (server/auth.ts:160-161) and must stay deliberate here: telling a caller
  // which of the four it was turns this route into an account enumerator.
  if (!identity) {
    return fail("INVALID_CREDENTIALS", "That email and password do not match a DNMS account", 401)
  }

  // A client-portal account. `prefer: "STAFF"` is a preference and not a filter,
  // so a client-only person gets in here as kind: "client" - and every screen in
  // this app would then 403, because there is no employees row behind them.
  //
  // issueSession() refuses this too (NOT_STAFF, 403), but it cannot say WHY in a
  // sentence that helps: it does not know a client portal exists on the web. The
  // distinct code and message are what let the app point them at it instead of
  // showing "wrong password" to someone who typed their password correctly.
  if (identity.kind !== "employee") {
    return fail(
      "NOT_STAFF",
      "This is a client portal account - please sign in on the DNMS website",
      403,
    )
  }

  try {
    // authorizeWithIdentity()'s return value IS a MobileIdentity, field for field.
    const issued = await issueSession(identity, mobileDeviceInput(body.device))
    return ok(issuedBody(issued))
  } catch (err) {
    // NOT_STAFF (403) for a membership that died between the two reads above, or
    // INVALID_DEVICE (400) for a platform that is not ios/android.
    return mobileAuthFailure(err)
  }
})
