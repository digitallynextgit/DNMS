import "server-only"

import bcrypt from "bcryptjs"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"

// One `users` row per human (by email); `memberships` binds a user to a tenant as STAFF or CLIENT
// and points at the profile row (employees / client_users).
// setPassword() is the ONLY place allowed to write a password hash.

/** Matches every existing hash in the database. */
const BCRYPT_ROUNDS = 12

/** `users.email` has a case-sensitive unique index, so every read and write goes through here. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export interface LoginCandidate {
  id: string
  email: string
  name: string
  passwordHash: string | null
  mustChangePassword: boolean
  isActive: boolean
}

/** WITH the password hash - the global omit in server/db.ts is bypassed by the explicit select. */
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
  /** An employee id or a client_user id. */
  profileId: string
  /** The user's flag, carried here to save the JWT re-check a query. */
  mustChangePassword: boolean
  /** The JWT re-check revokes sessions issued before this. */
  passwordChangedAt: Date | null
}

/**
 * Checks the user, the membership and the tenant: a suspended, read-only or lapsed-trial tenant
 * yields no membership, so its people simply cannot sign in.
 */
export async function loadActiveMemberships(userId: string): Promise<ActiveMembership[]> {
  return runUnscoped("sign-in: which companies does this person belong to", async () => {
    const rows = await db.membership.findMany({
      where: {
        userId,
        isActive: true,
        user: { isActive: true },
        tenant: { status: "ACTIVE" },
        // The profile row's own switch is the one HR actually uses.
        OR: [{ employee: { isActive: true } }, { clientUser: { isActive: true } }],
      },
      select: {
        id: true,
        kind: true,
        tenantId: true,
        employeeId: true,
        clientUserId: true,
        tenant: { select: { slug: true, name: true, plan: true, trialEndsAt: true } },
        user: { select: { mustChangePassword: true, passwordChangedAt: true } },
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
        passwordChangedAt: r.user.passwordChangedAt,
      }))
  })
}

/** Unscoped: this runs in the JWT callback, which is what decides the tenant. */
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
        user: { select: { mustChangePassword: true, passwordChangedAt: true } },
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
      passwordChangedAt: row.user.passwordChangedAt,
    }
  })
}

export async function userIdForEmployee(employeeId: string): Promise<string | null> {
  const m = await db.membership.findUnique({ where: { employeeId }, select: { userId: true } })
  return m?.userId ?? null
}

export async function userIdForClientUser(clientUserId: string): Promise<string | null> {
  const m = await db.membership.findUnique({ where: { clientUserId }, select: { userId: true } })
  return m?.userId ?? null
}

export type PasswordTarget = { employeeId: string } | { clientUserId: string } | { userId: string }

/**
 * THE ONLY sanctioned way to write a credential. Writes `users` and the legacy profile
 * column(s) in one transaction. Pass mustChangePassword: true for an issued or admin-reset one.
 */
export async function setPassword(
  target: PasswordTarget,
  plainPassword: string,
  { mustChangePassword = false }: { mustChangePassword?: boolean } = {},
): Promise<{ userId: string }> {
  const hash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS)

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
    // Fail loudly rather than write a password no login path will ever read.
    throw new Error(
      `setPassword: no platform identity (users row + membership) for ${JSON.stringify(target)}`,
    )
  }

  const employeeIds = memberships.filter((m) => m.employeeId).map((m) => m.employeeId as string)
  const clientUserIds = memberships
    .filter((m) => m.clientUserId)
    .map((m) => m.clientUserId as string)

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      // passwordChangedAt revokes every session issued before this write.
      data: { passwordHash: hash, mustChangePassword, passwordChangedAt: new Date() },
    }),
    // TRANSITIONAL: legacy columns; remove together with them.
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
 * Idempotent. A known email keeps its existing user and credential and just gains a membership:
 * one password, many roles.
 */
export async function provisionIdentity(input: {
  email: string
  name: string
  tenantId: string
  kind: "STAFF" | "CLIENT"
  employeeId?: string
  clientUserId?: string
  /** Ignored if the user already exists. */
  passwordHash?: string | null
  mustChangePassword?: boolean
}): Promise<{ userId: string; membershipId: string }> {
  const email = normalizeEmail(input.email)

  const user = await db.user.upsert({
    where: { email },
    // Never overwrite an existing person's name or credential from a new profile row.
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
 * TRANSITIONAL: create the missing identity for an account with only a legacy password hash, after
 * the same bcrypt check. Null when there is no such account or the password is wrong.
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
