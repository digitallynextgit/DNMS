import "server-only"

import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"

// =============================================================================
// Platform identity (M2).
//
// One `users` row per human, keyed by email. `memberships` binds a user to a
// tenant in one capacity (STAFF or CLIENT) and points at the profile row that
// carries their data - an `employees` row or a `client_users` row.
//
// ── THE DUAL-WRITE, AND WHY IT EXISTS ────────────────────────────────────────
// The build running on the VPS right now authenticates against
// employees.password_hash / client_users.password_hash. Those columns are still
// there and still authoritative FOR THAT BUILD. So every password write has to
// land in both places, or one of these happens:
//
//   - deploy the new build, someone changes their password, roll back → they
//     are locked out, and so is anyone else whose password changed meanwhile
//   - run both builds side by side during a rolling deploy → half the requests
//     check a stale hash
//
// `setPassword()` below is the ONLY function permitted to write a password
// hash. Nothing else in the codebase should call bcrypt.hash for a credential.
// When the legacy columns are dropped in M4, this file is the single place that
// changes.
// =============================================================================

/** Bcrypt cost. Matches what every existing hash in the database was made with. */
const BCRYPT_ROUNDS = 12

/**
 * The canonical form of an email address for identity purposes.
 *
 * `users.email` has a case-SENSITIVE unique index (Postgres default), so the
 * "one address, one row" invariant is the application's to keep. Every read and
 * every write of that column goes through here.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface LoginCandidate {
  id: string
  email: string
  name: string
  passwordHash: string | null
  mustChangePassword: boolean
  isActive: boolean
}

/**
 * Look up a user for a sign-in attempt, WITH the password hash.
 *
 * `passwordHash` is stripped from every query by default (see server/db.ts).
 * Naming it in an explicit `select` is what opts back in - Prisma refuses
 * `select` and `omit` in the same call - and this is one of the few places
 * allowed to do it.
 */
export async function findLoginUser(email: string): Promise<LoginCandidate | null> {
  return db.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      mustChangePassword: true,
      isActive: true,
    },
  })
}

export interface ActiveMembership {
  id: string
  kind: "STAFF" | "CLIENT"
  tenantId: string
  tenantSlug: string
  tenantName: string
  /** The profile row id - an employee id or a client_user id. */
  profileId: string
  /**
   * The USER's flag, carried here so the token re-check does not need a second
   * query for it. The membership query already joins `users` to test isActive.
   */
  mustChangePassword: boolean
}

/**
 * Every membership this user can currently sign in through.
 *
 * Filtered on all three levels that can revoke access independently: the user,
 * the membership, and the tenant. A tenant that is SUSPENDED or READ_ONLY, or
 * whose trial has lapsed, yields no membership - so a lapsed customer's staff
 * simply cannot sign in, without any code in the login path knowing about plans.
 */
export async function loadActiveMemberships(userId: string): Promise<ActiveMembership[]> {
  return runUnscoped("sign-in: which companies does this person belong to", async () => {
    const rows = await db.membership.findMany({
      where: {
        userId,
        isActive: true,
        user: { isActive: true },
        tenant: { status: "ACTIVE" },
        // The profile row has its own switch, and it is the one HR actually uses.
        OR: [{ employee: { isActive: true } }, { clientUser: { isActive: true } }],
      },
      select: {
        id: true,
        kind: true,
        tenantId: true,
        employeeId: true,
        clientUserId: true,
        tenant: { select: { slug: true, name: true, plan: true, trialEndsAt: true } },
        user: { select: { mustChangePassword: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    const now = Date.now()
    return rows
      .filter((r) => {
        // An expired trial is not an active tenant, whatever `status` says.
        if (
          r.tenant.plan === "TRIAL" &&
          r.tenant.trialEndsAt &&
          r.tenant.trialEndsAt.getTime() < now
        )
          return false
        return true
      })
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        tenantId: r.tenantId,
        tenantSlug: r.tenant.slug,
        tenantName: r.tenant.name,
        profileId: (r.kind === "STAFF" ? r.employeeId : r.clientUserId) as string,
        mustChangePassword: r.user.mustChangePassword,
      }))
  })
}

/**
 * One membership by id, re-checked against the same three switches.
 *
 * Unscoped for the same reason as above: this runs in the JWT callback, which is
 * what DECIDES the tenant. Scoping it by the tenant would be circular.
 */
export async function loadMembershipIfStillValid(
  membershipId: string,
): Promise<ActiveMembership | null> {
  return runUnscoped("sign-in: re-checking a membership decides the tenant", async () => {
    const row = await db.membership.findFirst({
      where: {
        id: membershipId,
        isActive: true,
        user: { isActive: true },
        tenant: { status: "ACTIVE" },
        OR: [{ employee: { isActive: true } }, { clientUser: { isActive: true } }],
      },
      select: {
        id: true,
        kind: true,
        tenantId: true,
        employeeId: true,
        clientUserId: true,
        tenant: { select: { slug: true, name: true, plan: true, trialEndsAt: true } },
        user: { select: { mustChangePassword: true } },
      },
    })
    if (!row) return null
    if (
      row.tenant.plan === "TRIAL" &&
      row.tenant.trialEndsAt &&
      row.tenant.trialEndsAt.getTime() < Date.now()
    ) {
      return null
    }
    return {
      id: row.id,
      kind: row.kind,
      tenantId: row.tenantId,
      tenantSlug: row.tenant.slug,
      tenantName: row.tenant.name,
      profileId: (row.kind === "STAFF" ? row.employeeId : row.clientUserId) as string,
      mustChangePassword: row.user.mustChangePassword,
    }
  })
}

/** The user id behind a profile row, for code that only holds the old identifier. */
export async function userIdForEmployee(employeeId: string): Promise<string | null> {
  const m = await db.membership.findUnique({ where: { employeeId }, select: { userId: true } })
  return m?.userId ?? null
}

export async function userIdForClientUser(clientUserId: string): Promise<string | null> {
  const m = await db.membership.findUnique({ where: { clientUserId }, select: { userId: true } })
  return m?.userId ?? null
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type PasswordTarget = { employeeId: string } | { clientUserId: string } | { userId: string }

/**
 * Set someone's password. THE ONLY sanctioned way to write a credential.
 *
 * Writes `users.password_hash` AND the legacy profile column in one
 * transaction, so the two can never disagree - see the dual-write note at the
 * top of this file for why the legacy column still matters.
 *
 * Accepts whichever identifier the caller happens to hold; the others are
 * resolved from the membership. Passing `{ userId }` for someone who has both a
 * staff and a client membership updates both legacy columns, which is correct:
 * it is one password.
 *
 * @param plainPassword  Pre-validated by the caller's zod schema. Hashed here.
 * @param mustChangePassword  Defaults to false - the common case is a person
 *   choosing their own password. Pass true for an issued or admin-reset one.
 */
export async function setPassword(
  target: PasswordTarget,
  plainPassword: string,
  { mustChangePassword = false }: { mustChangePassword?: boolean } = {},
): Promise<{ userId: string }> {
  const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)

  // Resolve every identifier this password belongs to.
  const memberships = await db.membership.findMany({
    where:
      "userId" in target
        ? { userId: target.userId }
        : "employeeId" in target
          ? { employeeId: target.employeeId }
          : { clientUserId: target.clientUserId },
    select: { userId: true, employeeId: true, clientUserId: true },
  })

  const userId = memberships[0]?.userId ?? ("userId" in target ? target.userId : null)
  if (!userId) {
    // No membership and no user id means the identity row was never created -
    // a backfill gap, not a user error. Fail loudly rather than write a
    // password that no login path will ever read.
    throw new Error(
      `setPassword: no platform identity for ${JSON.stringify(target)} - ` +
        `run prisma/verify-identity.ts, the M2 backfill has a gap`,
    )
  }

  // Every membership found shares this user, but be explicit rather than trust it.
  const employeeIds = memberships.filter((m) => m.employeeId).map((m) => m.employeeId as string)
  const clientUserIds = memberships
    .filter((m) => m.clientUserId)
    .map((m) => m.clientUserId as string)

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: hash, mustChangePassword } }),
    // TRANSITIONAL: the legacy columns the deployed build still authenticates
    // against. Delete these two updates in M4, with the columns.
    ...(employeeIds.length
      ? [
          db.employee.updateMany({
            where: { id: { in: employeeIds } },
            data: { passwordHash: hash, mustChangePassword },
          }),
        ]
      : []),
    ...(clientUserIds.length
      ? [
          db.clientUser.updateMany({
            where: { id: { in: clientUserIds } },
            data: { passwordHash: hash, mustChangePassword },
          }),
        ]
      : []),
  ])

  return { userId }
}

/**
 * Create the platform identity for a NEW employee or client, or attach an
 * existing one when the address is already known to the platform.
 *
 * Idempotent: safe to call for someone who already has a membership.
 *
 * The `users` row is only created when the address is new. When it already
 * exists - the same person joining a second company, or a staff member being
 * given portal access - the existing credential is kept and a second membership
 * is added. That is the whole point of the split: one password, many roles.
 */
export async function provisionIdentity(input: {
  email: string
  name: string
  tenantId: string
  kind: "STAFF" | "CLIENT"
  employeeId?: string
  clientUserId?: string
  /** Hash to seed a brand-new user row with. Ignored if the user already exists. */
  passwordHash?: string | null
  mustChangePassword?: boolean
}): Promise<{ userId: string; membershipId: string }> {
  const email = normalizeEmail(input.email)

  const user = await db.user.upsert({
    where: { email },
    // Do NOT overwrite an existing person's name or credential from a new
    // profile row - they own their platform identity, not whichever record
    // referenced them last.
    update: {},
    create: {
      email,
      name: input.name,
      passwordHash: input.passwordHash ?? null,
      mustChangePassword: input.mustChangePassword ?? true,
    },
    select: { id: true },
  })

  const membership = await db.membership.upsert({
    where: {
      userId_tenantId_kind: { userId: user.id, tenantId: input.tenantId, kind: input.kind },
    },
    update: { isActive: true },
    create: {
      userId: user.id,
      tenantId: input.tenantId,
      kind: input.kind,
      employeeId: input.kind === "STAFF" ? input.employeeId : null,
      clientUserId: input.kind === "CLIENT" ? input.clientUserId : null,
    },
    select: { id: true },
  })

  return { userId: user.id, membershipId: membership.id }
}

/**
 * TRANSITIONAL: build the missing identity for someone who can prove the legacy
 * password, and return them. Delete in M4 together with the legacy columns.
 *
 * The gap this closes: between the moment the M2 migration runs and the moment
 * the new build is deployed, the OLD build is still live and can create
 * employees and client users. Those rows get no `users` row and no membership,
 * because only the new code knows to make one - so without this they would be
 * unable to sign in to the new build at all.
 *
 * It is not a weaker check. The same bcrypt comparison runs, against the same
 * hash the deployed build authenticates with; all this does is write down the
 * identity that should already have existed.
 *
 * Returns null when there is no such legacy account, or the password is wrong.
 */
export async function adoptLegacyLogin(
  rawEmail: string,
  plainPassword: string,
): Promise<LoginCandidate | null> {
  return runUnscoped("sign-in: matching an email to an account precedes knowing the tenant", () =>
    adoptLegacyLoginUnscoped(rawEmail, plainPassword),
  )
}

async function adoptLegacyLoginUnscoped(
  rawEmail: string,
  plainPassword: string,
): Promise<LoginCandidate | null> {
  const email = normalizeEmail(rawEmail)

  const employee = await db.employee.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      mustChangePassword: true,
      isActive: true,
      tenantId: true,
    },
  })
  if (employee?.passwordHash && employee.isActive) {
    if (!(await bcrypt.compare(plainPassword, employee.passwordHash))) return null
    const name = `${employee.firstName} ${employee.lastName}`
    const { userId } = await provisionIdentity({
      email: employee.email,
      name,
      tenantId: employee.tenantId,
      kind: "STAFF",
      employeeId: employee.id,
      passwordHash: employee.passwordHash,
      mustChangePassword: employee.mustChangePassword,
    })
    console.warn(`[IDENTITY] adopted legacy staff login for ${email} - created by a pre-M2 build`)
    return {
      id: userId,
      email: employee.email,
      name,
      passwordHash: employee.passwordHash,
      mustChangePassword: employee.mustChangePassword,
      isActive: true,
    }
  }

  const client = await db.clientUser.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      mustChangePassword: true,
      isActive: true,
      tenantId: true,
    },
  })
  if (client?.passwordHash && client.isActive) {
    if (!(await bcrypt.compare(plainPassword, client.passwordHash))) return null
    const { userId } = await provisionIdentity({
      email: client.email,
      name: client.name,
      tenantId: client.tenantId,
      kind: "CLIENT",
      clientUserId: client.id,
      passwordHash: client.passwordHash,
      mustChangePassword: client.mustChangePassword,
    })
    console.warn(`[IDENTITY] adopted legacy client login for ${email} - created by a pre-M2 build`)
    return {
      id: userId,
      email: client.email,
      name: client.name,
      passwordHash: client.passwordHash,
      mustChangePassword: client.mustChangePassword,
      isActive: true,
    }
  }

  return null
}

/** Mirror a profile row's active flag onto its membership. */
export async function setMembershipActive(
  target: { employeeId: string } | { clientUserId: string },
  isActive: boolean,
): Promise<void> {
  await db.membership.updateMany({ where: target, data: { isActive } })
}

/** Keep `users.email` / `users.name` in step when a profile row is edited. */
export async function syncIdentityProfile(
  target: { employeeId: string } | { clientUserId: string },
  patch: { email?: string; name?: string },
): Promise<void> {
  if (patch.email === undefined && patch.name === undefined) return
  const membership = await db.membership.findUnique({
    where: target,
    select: { userId: true },
  })
  if (!membership) return
  await db.user.update({
    where: { id: membership.userId },
    data: {
      ...(patch.email !== undefined ? { email: normalizeEmail(patch.email) } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
    },
  })
}
