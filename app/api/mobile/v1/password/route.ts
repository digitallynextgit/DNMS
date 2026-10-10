import { withErrorHandler, respond } from "@/server/api-handler"
import { ok, fail } from "@/lib/api-response"
import { db } from "@/server/db"
import { setOwnPassword } from "@/features/auth/server/auth.service"
import {
  issueSession,
  resolveMobilePrincipal,
  revokeAllForUser,
  runAsMobilePrincipal,
  type MobileIdentity,
} from "@/server/mobile-auth"
import { mobilePasswordSchema } from "@/features/auth/schemas/mobile-auth.schema"
import {
  ipThrottled,
  issuedBody,
  mobileAuthFailure,
  readJsonBody,
  throttled,
} from "@/features/auth/server/mobile-auth-http"

// -----------------------------------------------------------------------------
// POST /api/mobile/v1/password - change your own password AND get a fresh pair
// back in the SAME response.
//
// THE SECOND HALF OF THAT SENTENCE IS NOT A CONVENIENCE. setOwnPassword() calls
// setPassword(), which writes users.passwordChangedAt, and that column's own
// comment is "passwordChangedAt revokes every session issued before this write"
// (server/identity.ts:202-203). The session that made this call is one of those.
// So by the time this handler is ready to answer, the credential the caller used
// to reach it is dead - and so is its refresh token, which means there is nothing
// left to refresh WITH. The pair in this response is the only way back in.
//
// Returning an ack instead is a PERMANENT LOCKOUT, recoverable only through
// forgot-password. The app used to paper over it by firing a rotation afterwards
// and swallowing the failure (dnmsApp auth.api.ts:93-105, now fixed); swallowing
// a failed rotation there was swallowing exactly this.
//
// WHY THIS CANNOT GO THROUGH THE DISPATCHER: api-policy.ts:15 excludes
// /api/password from the catalog entirely, so the in-process dispatcher at
// /api/mobile/v1/dnms/[...path] cannot reach it. That exclusion is correct and
// stays - it is what keeps password changes away from the AI connector - which is
// why this is a hand-written route rather than one more dispatched path.
//
// THE ORDER BELOW IS THE ONLY SAFE ONE, and it is not obvious:
//   1. setOwnPassword()            writes passwordChangedAt
//   2. revokeAllForUser(...)       every OTHER device loses its session too
//   3. issueSession(...)           survives, because createdAt > passwordChangedAt
// Minting before step 1 would mint a session that step 1 then revokes - the new
// pair would be dead on arrival and the lockout would be identical. Step 2 before
// step 3 for the same reason, in reverse: the credential that changed is
// users.passwordHash, which is platform-wide, so every handset has to go.
//
// mustChangePassword is deliberately NOT a gate here. This is the route that
// clears it, so fencing it would lock out exactly the people it exists for.
// resolveMobilePrincipal() carries the flag and does not enforce it; the
// dispatcher is what fences every other path with it.
//
// NOTHING in this file logs. The body is a plaintext password and the response is
// a token pair.
// -----------------------------------------------------------------------------

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = withErrorHandler(async (req) => {
  // Loose: an HR-wide "must change password" reset has a whole office changing
  // theirs from one IP within the hour, and locking that out is worse than any
  // flood this would stop. The per-session cap below is the real guard.
  const flooding = ipThrottled(req, "password", 120, 15 * 60_000)
  if (flooding) return flooding

  // Self-authenticating: /api/mobile is a PUBLIC_PREFIX, so this call is the only
  // thing standing between an anonymous POST and a password write. It re-reads
  // the membership and the permission set, so a revoked session, a deactivated
  // employee or a suspended tenant is refused here and not at token expiry.
  const principal = await resolveMobilePrincipal(req)
  if (!principal) {
    return fail("UNAUTHORIZED", "Sign in again to change your password", 401)
  }

  // Holding a valid token is not a licence to grind bcrypt: setPassword() hashes
  // at 12 rounds (server/identity.ts:12), which is deliberately expensive.
  const grinding = throttled(`mobile:password:session:${principal.sessionId}`, 5, 15 * 60_000)
  if (grinding) return grinding

  const body = mobilePasswordSchema.parse(await readJsonBody(req))

  // ---------------------------------------------------------------------------
  // STEP 1. Inside the caller's own tenant and identity, because setOwnPassword()
  // -> requireSession() -> getSession() reads delegatedSession() FIRST
  // (server/api-handler.ts:19-20) - that branch is the entire reason a
  // cookie-less caller needs no changes to the existing service.
  // ---------------------------------------------------------------------------
  const change = await runAsMobilePrincipal(principal, async () => {
    // Read BEFORE the change, while the row is still the current session's.
    // MobilePrincipal does not carry deviceName and issueSession() cannot invent
    // one, so without this the replacement row shows as a nameless entry in the
    // "my devices" list - the one place a lost phone is identified. One primary-key
    // lookup, narrowed to this tenant by the guard (server/tenant-guard.ts:131-133).
    const row = await db.mobileSession.findUnique({
      where: { id: principal.sessionId },
      select: { deviceName: true },
    })
    const result = await setOwnPassword(body.newPassword)
    return { deviceName: row?.deviceName ?? null, result }
  })

  // Nothing has been written yet when this fails, so there is no half-state to
  // recover from. respond() is the house mapper for an ActionResult failure.
  if (!change.result.ok) return respond(change.result)

  // ---------------------------------------------------------------------------
  // STEP 2. Every device, in every company. revokeAllForUser() runs unscoped on
  // purpose: the credential that just changed is users.passwordHash, which is
  // platform-wide, so a tenant-filtered sweep would leave a live session behind
  // in the other company. (No user holds two memberships today - verified - but
  // the schema allows it and this is where getting it wrong is silent.)
  // ---------------------------------------------------------------------------
  await revokeAllForUser(principal.userId, "password_changed")

  // ---------------------------------------------------------------------------
  // STEP 3. The replacement session, for THIS handset.
  //
  // The device is taken from the principal and never from the body - see the note
  // on mobilePasswordSchema. The password is already changed and every session is
  // already revoked by this point, so a refusal here would be a lockout; taking
  // the platform from a row issueSession() itself wrote and validated removes the
  // only avoidable way that could happen. What remains - the membership dying
  // between step 1 and here - leaves the user needing forgot-password, and is
  // both vanishingly rare and genuinely correct (they no longer have an account).
  //
  // Same deviceId, so the "one live session per install" replace step lines the
  // new row up with the old one in the device list rather than adding a second.
  // ---------------------------------------------------------------------------
  const identity: MobileIdentity = {
    id: principal.employeeId,
    email: principal.session.user.email,
    name: principal.session.user.name ?? "",
    kind: "employee",
    userId: principal.userId,
    membershipId: principal.membershipId,
    tenantId: principal.tenantId,
    tenantSlug: principal.tenantSlug,
    // Just cleared by setPassword()'s default. issueSession() re-reads the row
    // anyway, so this field is honesty rather than instruction.
    mustChangePassword: false,
  }

  try {
    const issued = await issueSession(identity, {
      deviceId: principal.deviceId,
      platform: principal.platform,
      deviceName: change.deviceName,
      appVersion: principal.appVersion,
    })
    return ok(issuedBody(issued))
  } catch (err) {
    return mobileAuthFailure(err)
  }
})
