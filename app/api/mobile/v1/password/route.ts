import bcrypt from "bcryptjs"

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
// TWO CALLERS, told apart by one OPTIONAL field. Without `currentPassword` this
// is the forced-change path (the account is in mustChangePassword and the person
// may never have known the old password). WITH it, it is a voluntary change from
// Settings, and STEP 0 below proves ownership with bcrypt before anything is
// written. Settings used to go to `PATCH /api/profile` instead, which is the only
// OTHER endpoint that checks the old password - but it answers with a profile
// projection and no tokens, so it killed its own session and locked the app out
// until the next sign-in (dnmsApp src/features/profile/profile.api.ts recorded
// that gap for months). The bcrypt check and the fresh pair had to come from the
// same call, which is why the optional field landed HERE.
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
//   0. bcrypt.compare(...)         refuse BEFORE any write, when proof was offered
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
  // at 12 rounds (server/identity.ts:12), which is deliberately expensive. With
  // `currentPassword` in the body this bucket is ALSO the old-password guessing
  // limit - 5 per session per 15 minutes - which is why a wrong guess below is
  // allowed to spend one of them.
  const grinding = throttled(`mobile:password:session:${principal.sessionId}`, 5, 15 * 60_000)
  if (grinding) return grinding

  const body = mobilePasswordSchema.parse(await readJsonBody(req))

  // ---------------------------------------------------------------------------
  // STEP 0. Proof of ownership, for the callers that offered it.
  //
  // Absent `currentPassword` this does nothing, which keeps the forced-change
  // screen working exactly as before (see the note on mobilePasswordSchema for
  // why it cannot be required). Present, it must pass BEFORE step 1, because
  // step 1 is irreversible and step 2 signs every device out.
  //
  // Against `users.passwordHash` and not the legacy `employees.passwordHash` that
  // PATCH /api/profile reads: `users` is the row the mobile sign-in path itself
  // compares (findLoginUser -> server/auth.ts:155) and the row setOwnPassword is
  // about to write, so verifying anywhere else would be verifying a copy.
  // setPassword() writes both in one transaction, so they agree today - this just
  // does not depend on that staying true.
  //
  // `users` has no tenantId, so it is not in tenant-guard's scoped set
  // (server/tenant-guard.ts:23-27) and this read needs no tenant context - the
  // same reason revokeAllForUser() can run unscoped below. The explicit select is
  // what opts back into the hash, which server/db.ts omits globally.
  //
  // 400 and never 401: the app replays any 401 on a non-refresh call after a
  // refresh (dnmsApp src/lib/api-client.ts:310-320), so answering 401 for a
  // mistyped password would re-POST the whole change.
  // ---------------------------------------------------------------------------
  if (body.currentPassword) {
    const user = await db.user.findUnique({
      where: { id: principal.userId },
      select: { passwordHash: true },
    })
    // Null = "invited but never activated, or a Google-only account"
    // (prisma/schema.prisma:46-47). Proof was offered and there is nothing to
    // check it against, so this cannot pass - and it must not SKIP either, which
    // is what a bare `if (hash && !compare)` would quietly do.
    //
    // It also means a Google-only user cannot ADD a first password from Settings,
    // because the app's card always sends the field. Same refusal as the endpoint
    // this replaced ("Cannot change password for this account", app/api/profile/
    // route.ts:70-74), just a sentence that says which case it is. Lifting it
    // needs a product decision about what proves ownership for an account that
    // has never had a password, so it is deliberately not invented here.
    if (!user?.passwordHash) {
      return fail(
        "NO_PASSWORD_SET",
        "This account has no password yet, so there is no current password to verify",
        400,
      )
    }
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      return fail("INVALID_CURRENT_PASSWORD", "Your current password is incorrect", 400)
    }
  }

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
