import "server-only"

import { randomUUID } from "node:crypto"
import type { Session } from "next-auth"
import type { MobileSession } from "@prisma/client"
import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { runAsDelegate } from "@/server/delegated-session"
import { loadMembershipIfStillValid } from "@/server/identity"
import { getUserWithPermissions } from "@/server/auth"
import { generateToken, sha256Hex } from "@/features/mcp/server/tokens"

// -----------------------------------------------------------------------------
// Mobile app session tokens. The token core for /api/mobile/v1 - PORTED from the
// AI connector (features/mcp/server/oauth.service.ts + principal.ts), not
// invented, because that code is already in production and already correct.
//
// The tokens are OPAQUE: 32 random bytes behind a prefix, stored only as SHA-256
// (generateToken / sha256Hex, reused verbatim from the MCP module). NOT a JWT,
// and that is the whole point:
//   - revocation is instant on the next call, not at the end of a 15-minute
//     claim window - which is the only thing a lost phone actually needs;
//   - there is no MOBILE_JWT_SECRET to provision, rotate or leak, and no `jose`.
// If someone "optimises" this into a signed token, the lost-phone story dies
// with it.
//
// THE ONE RULE IN THIS FILE: a token lookup decides the company, so it cannot be
// tenant-filtered - there is no tenant yet. Every read here therefore runs inside
// runUnscoped(), exactly as features/mcp/server/principal.ts:62-74 does. The
// cost of that is the other half of the rule: because the tenant guard neither
// filters nor STAMPS inside runUnscoped (server/tenant-guard.ts:113-118), every
// write in this file names tenantId itself. Forgetting it is a NOT NULL
// violation at insert, not a row quietly filed under the founding tenant.
//
// NOTHING HERE IS CACHED, deliberately. resolveMobilePrincipal() re-reads the
// membership and the permission set on EVERY request. With an opaque token that
// uncached re-read IS the revocation mechanism: it is what makes "HR deactivates
// the account" / "the password changed" / "sign out my lost phone" take effect on
// the next API call. A TTL cache in front of it would reintroduce exactly the lag
// the opaque token was chosen to remove. If the p95 ever hurts, narrow the
// SELECTs - never cache the answer.
// -----------------------------------------------------------------------------

/** Recognisable if one ever leaks into a log or a bug report. */
export const MOBILE_TOKEN_PREFIX = {
  ACCESS: "dnms_mt_",
  REFRESH: "dnms_mr_",
} as const

export const MOBILE_LIFETIME = {
  /**
   * Access token: 15 minutes. Short because the app's own comments assume it
   * (dnmsApp/src/features/auth/auth.api.ts) - not for security, which the
   * per-request re-check already provides.
   */
  ACCESS_MS: 15 * 60 * 1000,
  /** Refresh token: 30 days, rotated on every use - so idle 30 days = sign in again. */
  REFRESH_MS: 30 * 24 * 60 * 60 * 1000,
} as const

/**
 * Grace window in which a just-used refresh token is refused WITHOUT revoking.
 * Ported from oauth.service.ts:366. This is the detail a naive implementation
 * gets wrong: ten screens mounting on a cold start can all present the same
 * stored refresh token within a second of each other, and treating that as theft
 * signs the user out every time they open the app.
 */
const REFRESH_RACE_MS = 60 * 1000

/** Only touch lastSeenAt this often, so every request is not also a write. */
const LAST_SEEN_EVERY_MS = 5 * 60 * 1000

/** lib/push-mobile.ts routes FCM vs APNs off `platform`, so an unknown value never gets push. */
const PLATFORMS = new Set(["ios", "android"])

// -----------------------------------------------------------------------------
// Contract
// -----------------------------------------------------------------------------

/** The three refresh failures the app already branches on; all of them are 401. */
export type MobileRefreshFailure = "INVALID_REFRESH" | "SESSION_REVOKED" | "SESSION_EXPIRED"

export type MobileAuthErrorCode = MobileRefreshFailure | "NOT_STAFF" | "INVALID_DEVICE"

/** Routes turn this into {success:false,error:{code,message}} with `status`. */
export class MobileAuthError extends Error {
  constructor(
    public readonly code: MobileAuthErrorCode,
    message: string,
    public readonly status = 401,
  ) {
    super(message)
    this.name = "MobileAuthError"
  }
}

/**
 * What the handset tells us about itself. The app sends {platform, name,
 * appVersion} today (currentDevice(), dnmsApp/src/features/auth/auth.api.ts), so
 * a caller maps `name` -> `deviceName`.
 */
export interface MobileDeviceInput {
  /**
   * Stable per install, so "which of these is my old phone?" has an answer and a
   * re-login from the same handset replaces its session instead of adding one.
   * OPTIONAL because the app does not send one yet: without it a server-minted
   * id still identifies this session, it just cannot be matched to the previous
   * install, so the replace step is skipped.
   */
  deviceId?: string | null
  /** "ios" | "android". Anything else is refused - see PLATFORMS above. */
  platform: string
  /** Handset model, e.g. "iPhone 15 Pro". The app's DeviceInfo.name. */
  deviceName?: string | null
  appVersion?: string | null
}

/**
 * Exactly what authorizeWithIdentity() (server/auth.ts:128) returns, so the login
 * route can hand its result straight over. The Google and pairing routes compose
 * the same object from findLoginUser + loadActiveMemberships + pickMembership.
 */
export interface MobileIdentity {
  /** The PROFILE id (employees.id), as everywhere else in DNMS. */
  id: string
  email: string
  name: string
  kind: "employee" | "client"
  userId: string
  membershipId: string
  tenantId: string
  tenantSlug: string
  mustChangePassword: boolean
}

/** The user shape every /api/mobile/v1 response carries. Mirrored by the app's MobileUser. */
export interface MobileUser {
  id: string
  employeeNo: string
  email: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  roles: string[]
  permissions: string[]
  mustChangePassword: boolean
}

/** Returned by both issueSession() and rotate() - one shape, so refresh is a drop-in. */
export interface IssuedMobileSession {
  accessToken: string
  refreshToken: string
  /** Access-token lifetime in SECONDS, which is what the app stores. */
  expiresIn: number
  session: MobileSession
  user: MobileUser
  /**
   * The workspace the credential resolved to. Worth returning because NO existing
   * DNMS endpoint tells a mobile client which company it is signed in to.
   */
  tenantSlug: string
  tenantName: string
}

/** A verified phone, for the request it was verified on. Never cache or store one. */
export interface MobilePrincipal {
  /** Handed to runAsDelegate, so getSession() returns it and all 308 routes work unchanged. */
  session: Session
  sessionId: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  userId: string
  membershipId: string
  employeeId: string
  deviceId: string
  platform: string
  appVersion: string | null
  /** Access-token expiry, seconds since epoch. */
  expiresAt: number
  /** The dispatcher's 403 PASSWORD_CHANGE_REQUIRED fence reads this. */
  mustChangePassword: boolean
}

// -----------------------------------------------------------------------------
// Internals
// -----------------------------------------------------------------------------

/** Device strings come from the handset: cap them so a hostile client can't write a novel. */
function clamp(value: string | null | undefined, max = 120): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function bearerFrom(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header) return null
  const [scheme, ...rest] = header.trim().split(/\s+/)
  if (!scheme || scheme.toLowerCase() !== "bearer") return null
  return rest.join("") || null
}

/**
 * Both tokens for one session. Must be called inside runUnscoped (hence the
 * explicit tenantId) - see the banner.
 */
async function issueTokens(session: Pick<MobileSession, "id" | "tenantId">) {
  const accessToken = generateToken(MOBILE_TOKEN_PREFIX.ACCESS)
  const refreshToken = generateToken(MOBILE_TOKEN_PREFIX.REFRESH)
  const now = Date.now()
  // Two creates, not createMany - see safeCreateMany in prisma/seed.ts.
  await db.$transaction([
    db.mobileToken.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        kind: "access",
        tokenHash: sha256Hex(accessToken),
        expiresAt: new Date(now + MOBILE_LIFETIME.ACCESS_MS),
      },
    }),
    db.mobileToken.create({
      data: {
        tenantId: session.tenantId,
        sessionId: session.id,
        kind: "refresh",
        tokenHash: sha256Hex(refreshToken),
        expiresAt: new Date(now + MOBILE_LIFETIME.REFRESH_MS),
      },
    }),
  ])
  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(MOBILE_LIFETIME.ACCESS_MS / 1000),
  }
}

/**
 * The delegated session a dispatched route will see. Identical in shape to the
 * one the AI connector builds (principal.ts), so every existing permission check,
 * audit log and service reads a mobile caller exactly like a browser caller.
 */
async function sessionFor(
  mobileSession: MobileSession,
  membership: { id: string; tenantId: string; tenantSlug: string; mustChangePassword: boolean },
  expires: Date,
): Promise<Session | null> {
  const [user, data] = await Promise.all([
    db.user.findUnique({
      where: { id: mobileSession.userId },
      select: { email: true, name: true },
    }),
    getUserWithPermissions(mobileSession.employeeId),
  ])
  if (!user || !data) return null

  return {
    expires: expires.toISOString(),
    user: {
      id: data.employee.id,
      email: user.email,
      name: user.name ?? `${data.employee.firstName} ${data.employee.lastName}`.trim(),
      kind: "employee",
      userId: mobileSession.userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      employeeNo: data.employee.employeeNo,
      firstName: data.employee.firstName,
      lastName: data.employee.lastName,
      company: null,
      profilePhoto: data.employee.profilePhoto ?? null,
      roles: data.roles,
      permissions: data.permissions,
      mustChangePassword: membership.mustChangePassword,
    },
  }
}

/** Fire-and-forget heartbeat for the "my devices" list. Throttled; never blocks the request. */
function touchLastSeen(sessionId: string, lastSeenAt: Date | null, now: Date): void {
  if (lastSeenAt && now.getTime() - lastSeenAt.getTime() <= LAST_SEEN_EVERY_MS) return
  void db.mobileSession
    .update({ where: { id: sessionId }, data: { lastSeenAt: now } })
    .catch(() => {})
}

// -----------------------------------------------------------------------------
// Issue / rotate / revoke
// -----------------------------------------------------------------------------

/**
 * Sign a phone in. The caller has already proved who this is (password, Google
 * id_token or a pairing code); this only mints the session.
 *
 * Staff-only, twice over: the identity must be an employee AND the membership
 * must still be STAFF. That is the mobile-side replacement for the client/staff
 * split proxy.ts:298-310 does for cookie callers - the proxy cannot do it here,
 * because /api/mobile is a public prefix and the Edge has no database.
 */
export async function issueSession(
  identity: MobileIdentity,
  device: MobileDeviceInput,
): Promise<IssuedMobileSession> {
  if (identity.kind !== "employee") {
    throw new MobileAuthError("NOT_STAFF", "The DNMS app is for staff accounts only", 403)
  }
  const platform = device.platform?.trim().toLowerCase() ?? ""
  if (!PLATFORMS.has(platform)) {
    throw new MobileAuthError("INVALID_DEVICE", "device.platform must be ios or android", 400)
  }

  // Re-check the membership here rather than trusting the caller's object: it is
  // one query, and it is what makes a suspended tenant, a READ_ONLY tenant, a
  // lapsed TRIAL, a deactivated employee and a revoked membership all refuse to
  // issue a token (server/identity.ts:110-151). Also where tenantName comes from.
  const membership = await loadMembershipIfStillValid(identity.membershipId)
  if (!membership || membership.kind !== "STAFF" || membership.profileId !== identity.id) {
    throw new MobileAuthError("NOT_STAFF", "This DNMS account is not active in this workspace", 403)
  }

  const deviceId = clamp(device.deviceId, 200)

  return runUnscoped("mobile app: the credential decides the company, as at sign-in", async () => {
    // One live session per install. The old row is kept (revoked, not deleted) so
    // the device history survives, the same way a revoked OAuthGrant does.
    if (deviceId) {
      await db.mobileSession.updateMany({
        where: { membershipId: membership.id, deviceId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "replaced_by_new_sign_in" },
      })
    }

    const session = await db.mobileSession.create({
      data: {
        tenantId: membership.tenantId,
        userId: identity.userId,
        membershipId: membership.id,
        employeeId: membership.profileId,
        // A minted id is still unique per session; it just cannot match a previous install.
        deviceId: deviceId ?? randomUUID(),
        platform,
        deviceName: clamp(device.deviceName),
        appVersion: clamp(device.appVersion, 40),
        lastSeenAt: new Date(),
      },
    })

    const tokens = await issueTokens(session)
    const delegated = await sessionFor(
      session,
      membership,
      new Date(Date.now() + MOBILE_LIFETIME.ACCESS_MS),
    )
    if (!delegated) {
      throw new MobileAuthError("NOT_STAFF", "This DNMS account has no employee record", 403)
    }

    return {
      ...tokens,
      session,
      user: mobileUserFrom(delegated),
      tenantSlug: membership.tenantSlug,
      tenantName: membership.tenantName,
    }
  })
}

/**
 * Exchange a refresh token for a new pair. A verbatim port of
 * oauth.service.ts:368-421, including the three-tier reuse response:
 *
 *   used, inside REFRESH_RACE_MS  -> refuse, do NOT revoke (the app raced itself)
 *   used, after REFRESH_RACE_MS   -> treat as theft, revoke the whole session
 *   never used                    -> claim it atomically, then issue
 *
 * The claim is `updateMany({where: {id, usedAt: null}})`: only one concurrent
 * request can flip it, so two refreshes cannot both mint a pair.
 */
export async function rotate(refreshToken: string): Promise<IssuedMobileSession> {
  if (!refreshToken) {
    throw new MobileAuthError("INVALID_REFRESH", "refreshToken is required", 400)
  }

  return runUnscoped("mobile app: the refresh token decides the company", async () => {
    const token = await db.mobileToken.findUnique({
      where: { tokenHash: sha256Hex(refreshToken) },
      include: { session: true },
    })
    if (!token || token.kind !== "refresh") {
      throw new MobileAuthError("INVALID_REFRESH", "Unknown refresh token")
    }

    if (token.usedAt) {
      if (Date.now() - token.usedAt.getTime() > REFRESH_RACE_MS) {
        await revokeSessionById(token.sessionId, "refresh_token_reused")
        throw new MobileAuthError("SESSION_REVOKED", "This session was signed out - sign in again")
      }
      // Still inside the race window: the chain stays alive, the caller retries.
      throw new MobileAuthError("INVALID_REFRESH", "Refresh token already used")
    }
    if (token.revokedAt) {
      throw new MobileAuthError("SESSION_REVOKED", "This session was signed out - sign in again")
    }
    if (token.expiresAt < new Date()) {
      throw new MobileAuthError("SESSION_EXPIRED", "This session expired - sign in again")
    }

    const session = token.session
    if (session.revokedAt) {
      throw new MobileAuthError("SESSION_REVOKED", "This device was signed out - sign in again")
    }

    // Every sign-in gate, re-applied at refresh time: offboarded, deactivated,
    // tenant suspended or read-only, trial lapsed.
    const membership = await loadMembershipIfStillValid(session.membershipId)
    if (!membership || membership.kind !== "STAFF" || membership.profileId !== session.employeeId) {
      await revokeSessionById(session.id, "membership_inactive")
      throw new MobileAuthError("SESSION_REVOKED", "This DNMS account is no longer active")
    }
    if (membership.passwordChangedAt && membership.passwordChangedAt > session.createdAt) {
      await revokeSessionById(session.id, "password_changed")
      throw new MobileAuthError("SESSION_REVOKED", "The DNMS password changed - sign in again")
    }

    const claimed = await db.mobileToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (claimed.count !== 1) {
      throw new MobileAuthError("INVALID_REFRESH", "Refresh token already used")
    }

    const tokens = await issueTokens(session)
    const delegated = await sessionFor(
      session,
      membership,
      new Date(Date.now() + MOBILE_LIFETIME.ACCESS_MS),
    )
    if (!delegated) {
      throw new MobileAuthError("SESSION_REVOKED", "This DNMS account is no longer active")
    }

    touchLastSeen(session.id, session.lastSeenAt, new Date())

    return {
      ...tokens,
      session,
      user: mobileUserFrom(delegated),
      tenantSlug: membership.tenantSlug,
      tenantName: membership.tenantName,
    }
  })
}

/**
 * Sign this device out. Either token works (an access token identifies the same
 * session), and like RFC 7009 it always succeeds: a logout that 400s because the
 * token was already dead is a worse answer than one that does nothing.
 */
export async function revoke(refreshToken: string): Promise<void> {
  if (!refreshToken) return
  await runUnscoped("mobile app: signing out, the token decides the company", async () => {
    const token = await db.mobileToken.findUnique({
      where: { tokenHash: sha256Hex(refreshToken) },
      select: { sessionId: true },
    })
    if (!token) return
    await revokeSessionById(token.sessionId, "signed_out")
  })
}

/**
 * Kill one session by id - the "my devices" list, and the lost phone. Exported so
 * no caller ever writes a bare db.mobileSession.updateMany and forgets that this
 * table must be reached unscoped.
 */
export async function revokeSessionById(sessionId: string, reason: string): Promise<void> {
  await runUnscoped("mobile app: revoking a session found by token or id", () =>
    db.mobileSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
  )
}

/**
 * Every device this person holds, in every company. Unscoped on purpose: the
 * credential being invalidated is `users.passwordHash`, which is platform-wide,
 * so a tenant-filtered sweep would leave a live session behind in the other
 * company. (No user holds two memberships today - verified - but the schema
 * allows it, and this is the one place where getting it wrong is silent.)
 *
 * The password route's recipe, in order: setOwnPassword() ->
 * revokeAllForUser(userId, "password_changed") -> issueSession(...). The new
 * session survives because its createdAt is after passwordChangedAt, which is
 * exactly the test rotate() and resolveMobilePrincipal() apply.
 */
export async function revokeAllForUser(userId: string, reason: string): Promise<number> {
  return runUnscoped(
    "mobile app: a password change or lost phone revokes every device",
    async () => {
      const { count } = await db.mobileSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      })
      return count
    },
  )
}

// -----------------------------------------------------------------------------
// Verify
// -----------------------------------------------------------------------------

/**
 * Bearer -> the person behind it, or null (the caller answers 401). Runs on every
 * mobile request, which is why a revoked session, a deactivated employee, a
 * suspended tenant, a changed password and a changed permission set all take
 * effect on the NEXT call rather than at token expiry.
 */
export async function resolveMobilePrincipal(req: Request): Promise<MobilePrincipal | null> {
  const bearer = bearerFrom(req)
  if (!bearer || !bearer.startsWith(MOBILE_TOKEN_PREFIX.ACCESS)) return null

  // Unscoped until the token decides the company - and mobile_tokens carries
  // tenantId, so without this the guard would narrow the lookup by a tenant we
  // do not know yet and throw in strict mode. Mirrors principal.ts:62-74.
  return runUnscoped("mobile app: the access token decides the company", async () => {
    const token = await db.mobileToken.findUnique({
      where: { tokenHash: sha256Hex(bearer) },
      include: { session: true },
    })
    if (!token || token.kind !== "access" || token.revokedAt || token.expiresAt <= new Date()) {
      return null
    }
    return principalForSession(token.session, token.expiresAt)
  })
}

/** Must run inside runUnscoped (the token decided the company, not a tenant context). */
async function principalForSession(
  session: MobileSession,
  accessExpiresAt: Date,
): Promise<MobilePrincipal | null> {
  const now = new Date()
  if (session.revokedAt) return null

  // NOT CACHED. This is the revocation mechanism - see the banner at the top.
  const membership = await loadMembershipIfStillValid(session.membershipId)
  if (!membership || membership.kind !== "STAFF" || membership.profileId !== session.employeeId) {
    return null
  }
  // The kill switch a password change pulls (server/identity.ts:202-203 writes it).
  if (membership.passwordChangedAt && membership.passwordChangedAt > session.createdAt) {
    await revokeSessionById(session.id, "password_changed")
    return null
  }

  const delegated = await sessionFor(session, membership, accessExpiresAt)
  if (!delegated) return null

  touchLastSeen(session.id, session.lastSeenAt, now)

  return {
    session: delegated,
    sessionId: session.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    tenantName: membership.tenantName,
    userId: session.userId,
    membershipId: membership.id,
    employeeId: session.employeeId,
    deviceId: session.deviceId,
    platform: session.platform,
    appVersion: session.appVersion,
    expiresAt: Math.floor(accessExpiresAt.getTime() / 1000),
    // Carried, NOT enforced here: the password route itself has to stay reachable.
    mustChangePassword: membership.mustChangePassword,
  } satisfies MobilePrincipal
}

/**
 * Run `fn` inside the principal's company and as them, so every existing DNMS
 * check applies unchanged. A copy of principal.ts:165-169: runWithTenant is the
 * STRONG form (tenant-context.ts:26-40 warns enterTenant's enterWith is weaker
 * and can outlive the call), and runAsDelegate is what makes getSession()
 * (server/api-handler.ts:19-21) return this session to a cookie-less caller -
 * which is why none of the 308 route handlers needed a single line changed.
 */
export function runAsMobilePrincipal<T>(
  principal: MobilePrincipal,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithTenant({ tenantId: principal.tenantId, slug: principal.tenantSlug }, () =>
    runAsDelegate(principal.session, fn),
  )
}

/** The user block every mobile response returns. Pure - no queries. */
export function mobileUserFrom(session: Session): MobileUser {
  const u = session.user
  return {
    id: u.id,
    employeeNo: u.employeeNo,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    profilePhoto: u.profilePhoto,
    roles: u.roles,
    permissions: u.permissions,
    mustChangePassword: u.mustChangePassword,
  }
}
