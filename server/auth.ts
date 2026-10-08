import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "./db"
import { clientIp, rateLimited } from "@/lib/rate-limit"
import { enterTenant, runUnscoped } from "./tenant-context"
import {
  adoptLegacyLogin,
  findLoginUser,
  loadActiveMemberships,
  loadMembershipIfStillValid,
  normalizeEmail,
  type ActiveMembership,
} from "./identity"
import type { NextAuthConfig } from "next-auth"

// Sign-in: prove who you are (a `users` row), then pick a membership (tenant + STAFF/CLIENT).
// `session.user.id` is still the PROFILE id (employee or client_user) - the whole app keys off
// it; the platform user id is `session.user.userId`.

/** How long a token may go without re-checking that the membership still exists. */
const MEMBERSHIP_RECHECK_MS = 15 * 60 * 1000

/** An employee's roles and flat permission scopes. Also used by the AI connector on every call. */
export async function getUserWithPermissions(employeeId: string) {
  // Unscoped: runs in the JWT callback, which decides the tenant. The employee id comes from a
  // membership already verified to belong to this user.
  return runUnscoped("sign-in: hydrating the token establishes the tenant", async () => {
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        employeeRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    })
    if (!employee) return null

    const roles = employee.employeeRoles.map((er) => er.role.name)
    const permissions = Array.from(
      new Set(
        employee.employeeRoles.flatMap((er) =>
          er.role.rolePermissions.map((rp) => rp.permission.scope),
        ),
      ),
    )

    return { employee, roles, permissions }
  })
}

// Clients hold no roles or scopes; their project access is checked per request, never cached
// in the token, so revoking a grant takes effect immediately.
async function getClientForToken(clientUserId: string) {
  return runUnscoped("sign-in: hydrating the token establishes the tenant", () =>
    db.clientUser.findUnique({
      where: { id: clientUserId },
      select: { id: true, email: true, name: true, company: true, isActive: true },
    }),
  )
}

/**
 * `prefer` is a preference, not a filter: a client-only account still gets in as a client.
 * Otherwise the first (oldest) membership wins; /select-workspace switches.
 */
function pickMembership(
  memberships: ActiveMembership[],
  prefer: "STAFF" | "CLIENT",
): ActiveMembership | null {
  if (memberships.length === 0) return null
  const preferred = memberships.filter((m) => m.kind === prefer)
  const pool = preferred.length > 0 ? preferred : memberships
  return pool[0] ?? null
}

/**
 * True when the credential changed after this token was issued. `authAt` is never refreshed, so a
 * session.update() from a stolen cookie cannot re-bless itself. Missing authAt reads as 0.
 */
function passwordChangedSince(tokenAuthAt: unknown, membership: ActiveMembership): boolean {
  if (!membership.passwordChangedAt) return false
  const authAt = typeof tokenAuthAt === "number" ? tokenAuthAt : 0
  return membership.passwordChangedAt.getTime() > authAt
}

async function hydrateFromMembership(membership: ActiveMembership) {
  if (membership.kind === "CLIENT") {
    const client = await getClientForToken(membership.profileId)
    if (!client) return null
    return {
      kind: "client" as const,
      id: client.id,
      employeeNo: "",
      firstName: client.name,
      lastName: "",
      profilePhoto: null as string | null,
      company: client.company ?? null,
      roles: [] as string[],
      permissions: [] as string[],
    }
  }

  const data = await getUserWithPermissions(membership.profileId)
  if (!data) return null
  return {
    kind: "employee" as const,
    id: data.employee.id,
    employeeNo: data.employee.employeeNo,
    firstName: data.employee.firstName,
    lastName: data.employee.lastName,
    profilePhoto: data.employee.profilePhoto ?? null,
    company: null as string | null,
    roles: data.roles,
    permissions: data.permissions,
  }
}

async function authorizeWithIdentity(
  rawEmail: unknown,
  rawPassword: unknown,
  prefer: "STAFF" | "CLIENT",
  req?: Request,
) {
  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") return null
  if (!rawEmail || !rawPassword) return null

  const email = normalizeEmail(rawEmail)

  // Guessing throttle, per email AND per IP (in-memory, per instance). Before any DB work.
  if (req) {
    const limited =
      rateLimited(`login:email:${email}`, 10, 15 * 60_000) ||
      rateLimited(`login:ip:${clientIp(req)}`, 30, 15 * 60_000)
    if (limited) return null
  }

  let candidate = await findLoginUser(email)

  // TRANSITIONAL: no platform identity yet - adopt the legacy account if its password checks out.
  if (!candidate) {
    candidate = await adoptLegacyLogin(email, rawPassword)
    if (!candidate) return null
  } else {
    if (!candidate.passwordHash || !candidate.isActive) return null
    if (!(await bcrypt.compare(rawPassword, candidate.passwordHash))) return null
  }

  const memberships = await loadActiveMemberships(candidate.id)
  const membership = pickMembership(memberships, prefer)
  // No live membership (offboarded, revoked, suspended): same answer as a bad password.
  if (!membership) return null

  return {
    id: membership.profileId,
    email: candidate.email,
    name: candidate.name,
    kind: membership.kind === "CLIENT" ? ("client" as const) : ("employee" as const),
    userId: candidate.id,
    membershipId: membership.id,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    mustChangePassword: candidate.mustChangePassword,
  }
}

export const authOptions: NextAuthConfig = {
  // No DB adapter: JWT sessions, and OAuth never auto-creates users. 7 days caps a stolen cookie.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  // Self-hosted behind a reverse proxy; without this Auth.js rejects every request (UntrustedHost).
  trustHost: true,

  secret: process.env.AUTH_SECRET,

  // Errors land on /login (as a toast), not Auth.js's "Access Denied" screen.
  pages: { signIn: "/login", error: "/login" },

  providers: [
    // Staff and portal clients both sign in here; the membership decides where they land.
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (c, req) => authorizeWithIdentity(c?.email, c?.password, "STAFF", req),
    }),

    // Only existing employees; no self-registration (enforced in callbacks.signIn).
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Returning a URL denies the sign-in and redirects, so /login can show the reason.
        if (!user.email) return "/login?error=no_account"

        const platformUser = await findLoginUser(user.email)
        if (!platformUser) return "/login?error=no_account"
        if (!platformUser.isActive) return "/login?error=deactivated"

        const membership = pickMembership(await loadActiveMemberships(platformUser.id), "STAFF")
        // Google is a staff door only.
        if (!membership || membership.kind !== "STAFF") return "/login?error=no_account"

        // Same identifiers as authorizeWithIdentity(), so the JWT callback treats both alike.
        user.id = membership.profileId
        user.kind = "employee"
        user.userId = platformUser.id
        user.membershipId = membership.id
        user.tenantId = membership.tenantId
        user.tenantSlug = membership.tenantSlug
        user.mustChangePassword = platformUser.mustChangePassword
      }
      return true
    },

    // Hydrates on sign-in and session.update(), and re-checks the membership every 15 minutes.
    // This also runs in proxy.ts on the EDGE, where `db` cannot connect - so all DB work is
    // skipped there (`onEdge`) and happens on Node instead.
    async jwt({ token, user, trigger, session }) {
      const now = Date.now()
      const onEdge = process.env.NEXT_RUNTIME === "edge"

      // Workspace switch. `session` is a browser payload: re-check the membership is this user's.
      if (!onEdge && trigger === "update" && typeof session?.membershipId === "string") {
        const target = await loadMembershipIfStillValid(session.membershipId)
        const owned =
          target &&
          (await runUnscoped("workspace switch: the target tenant is the thing being chosen", () =>
            db.membership.findFirst({
              where: { id: target.id, userId: token.userId as string },
              select: { id: true },
            }),
          ))
        // Invalid or someone else's: leave the token unchanged rather than fail the request.
        if (target && owned) {
          if (passwordChangedSince(token.authAt, target)) return null
          const profile = await hydrateFromMembership(target)
          if (profile) {
            Object.assign(token, profile)
            token.membershipId = target.id
            token.tenantId = target.tenantId
            token.tenantSlug = target.tenantSlug
            token.mustChangePassword = target.mustChangePassword
            token.checkedAt = now
            return token
          }
        }
      }

      // First sign-in. Never issue a token without a tenant.
      if (user?.membershipId) {
        if (!user.userId || !user.tenantId || !user.tenantSlug) return null
        token.userId = user.userId
        token.membershipId = user.membershipId
        token.tenantId = user.tenantId
        token.tenantSlug = user.tenantSlug
        token.mustChangePassword = user.mustChangePassword ?? false

        const membership = await loadMembershipIfStillValid(user.membershipId)
        if (!membership) return null
        const profile = await hydrateFromMembership(membership)
        if (!profile) return null
        Object.assign(token, profile)
        // The only place authAt is written.
        token.authAt = now
        token.checkedAt = now
        return token
      }

      // Legacy token without a membershipId: resolve one so it reaches the re-check below.
      if (!onEdge && !token.membershipId && token.id) {
        const kind = (token.kind as "employee" | "client" | undefined) ?? "employee"
        const existing = await runUnscoped(
          "legacy token upgrade: resolving the membership is what supplies the tenant",
          () =>
            db.membership.findUnique({
              where:
                kind === "client"
                  ? { clientUserId: token.id as string }
                  : { employeeId: token.id as string },
              select: { id: true, userId: true },
            }),
        )
        // Account gone: fail closed.
        if (!existing) return null
        token.membershipId = existing.id
        token.userId = existing.userId
        // checkedAt stays unset, so the re-check below runs immediately.
      }

      // The re-check is what makes revocation (roles, deactivation) take effect within 15 minutes.
      const membershipId = token.membershipId as string | undefined
      const stale = now - ((token.checkedAt as number | undefined) ?? 0) > MEMBERSHIP_RECHECK_MS

      if (!onEdge && membershipId && (trigger === "update" || stale)) {
        const membership = await loadMembershipIfStillValid(membershipId)
        // null invalidates the session cookie.
        if (!membership) return null

        // Also signs out the session that made the change (its UI says so).
        if (passwordChangedSince(token.authAt, membership)) return null

        const profile = await hydrateFromMembership(membership)
        if (!profile) return null

        Object.assign(token, profile)
        token.tenantId = membership.tenantId
        token.tenantSlug = membership.tenantSlug
        token.mustChangePassword = membership.mustChangePassword
        token.checkedAt = now
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        const kind = (token.kind as "employee" | "client" | undefined) ?? "employee"
        session.user.id = token.id as string
        session.user.kind = kind
        session.user.userId = (token.userId as string | undefined) ?? ""
        session.user.membershipId = (token.membershipId as string | undefined) ?? ""
        session.user.tenantId = (token.tenantId as string | undefined) ?? ""
        session.user.tenantSlug = (token.tenantSlug as string | undefined) ?? ""
        session.user.employeeNo = token.employeeNo as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        session.user.company = (token.company as string | null) ?? null
        session.user.profilePhoto = (token.profilePhoto as string | null) ?? null
        // A client never carries grants, whatever the token says.
        session.user.roles = kind === "client" ? [] : ((token.roles as string[]) ?? [])
        session.user.permissions = kind === "client" ? [] : ((token.permissions as string[]) ?? [])
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false
      }
      return session
    },
  },

  events: {
    // Bookkeeping only: a failure here must never block the login.
    async signIn({ user }) {
      if (!user?.id) return
      // These rows belong to the tenant just signed in to, so enter it rather than run unscoped.
      if (user.tenantId && user.tenantSlug) {
        enterTenant({ tenantId: user.tenantId, slug: user.tenantSlug })
      }

      if (user.userId) {
        try {
          await db.user.update({
            where: { id: user.userId },
            data: { lastLoginAt: new Date() },
          })
        } catch {
          // Non-critical.
        }
      }

      // Clients must not reach the audit log below: AuditLog.actorId is a FK into `employees`.
      if (user.kind === "client") {
        try {
          await db.clientUser.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          await db.clientActivityLog.create({
            data: {
              clientUserId: user.id,
              action: "auth:signin",
              module: "auth",
              summary: "Signed in to the portal",
            },
          })
        } catch {
          // Non-critical.
        }
        return
      }

      try {
        // Admin_ is a silent watch account - never log its logins.
        const isAdmin_ = await db.employeeRole.findFirst({
          where: { employeeId: user.id, role: { name: "admin_" } },
          select: { employeeId: true },
        })
        if (isAdmin_) return
        await db.auditLog.create({
          data: {
            actorId: user.id,
            action: "auth:login",
            module: "auth",
            entityType: "Employee",
            entityId: user.id,
          },
        })
      } catch {
        // Non-critical.
      }
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
