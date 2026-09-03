import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "./db"
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

// =============================================================================
// Authentication (M2 - platform identity).
//
// Sign-in is now TWO steps instead of one:
//
//   1. Prove who you are  → a `users` row, by email + password. One credential,
//      wherever you work and in whatever capacity.
//   2. Pick what you are  → a `memberships` row, which decides the tenant, the
//      kind (STAFF or CLIENT) and therefore which profile row carries your data.
//
// ── WHAT DELIBERATELY DID NOT CHANGE ─────────────────────────────────────────
// `token.id` / `session.user.id` is still the PROFILE id - the employee id for
// staff, the client_user id for a portal client. Several hundred queries key off
// it (`where: { employeeId: session.user.id }`), so repointing it at the new
// user id would have been a rewrite of the whole app disguised as an auth
// change. The platform id travels alongside as `session.user.userId`.
// =============================================================================

/** How long a token may go without re-checking that the membership still exists. */
const MEMBERSHIP_RECHECK_MS = 15 * 60 * 1000

// ---------------------------------------------------------------------------
// Helper - an employee's roles and flat permission scopes.
// ---------------------------------------------------------------------------
async function getUserWithPermissions(employeeId: string) {
  // Unscoped (M4): this runs in the JWT callback, which is what DECIDES the
  // tenant. The membership it is hydrating from has already been verified to
  // belong to this user, so the employee id is not attacker-supplied.
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

// ---------------------------------------------------------------------------
// Helper - load an external client account for the JWT.
// ---------------------------------------------------------------------------
// Clients are NOT employees (see the ClientUser model): they hold no roles and
// no permission scopes, so every staff-side `withAuth`/`requirePermission` check
// fails for them by construction. What they *can* see is resolved per request
// from client_project_access, never cached in the token - so revoking a project
// grant takes effect immediately instead of at their next sign-in.
// ---------------------------------------------------------------------------
async function getClientForToken(clientUserId: string) {
  // Unscoped for the same reason as getUserWithPermissions above.
  return runUnscoped("sign-in: hydrating the token establishes the tenant", () =>
    db.clientUser.findUnique({
      where: { id: clientUserId },
      select: { id: true, email: true, name: true, company: true, isActive: true },
    }),
  )
}

/**
 * Choose which membership a sign-in activates.
 *
 * `prefer` only matters for somebody who holds both a staff and a client
 * membership - a contractor who is also a client contact. /login prefers STAFF,
 * because that is the surface where they can do more; the workspace picker
 * takes them across to their client portal. It is a preference, not a filter:
 * a client-only account still gets in as a client, which is what makes one
 * login work for everyone.
 *
 * M3 replaces the "first tenant wins" line below with /select-workspace. It
 * cannot bite today - every membership is in Digitally Next - but it would as
 * soon as a second tenant exists, so it is called out rather than left implicit.
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

/** Everything the token needs about the person, resolved from one membership. */
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

/**
 * The shared body of both credentials providers.
 *
 * Returns the minimal user object Auth.js wants; the JWT callback does the
 * membership work. `membershipId` is passed through so the callback does not
 * have to resolve it a second time.
 */
async function authorizeWithIdentity(
  rawEmail: unknown,
  rawPassword: unknown,
  prefer: "STAFF" | "CLIENT",
) {
  if (typeof rawEmail !== "string" || typeof rawPassword !== "string") return null
  if (!rawEmail || !rawPassword) return null

  const email = normalizeEmail(rawEmail)

  let candidate = await findLoginUser(email)

  // TRANSITIONAL (M2 → M4): no platform identity means the account was created
  // by the pre-M2 build that is still deployed. Adopt it if the legacy password
  // checks out. See adoptLegacyLogin() for why this exists.
  if (!candidate) {
    candidate = await adoptLegacyLogin(email, rawPassword)
    if (!candidate) return null
  } else {
    if (!candidate.passwordHash || !candidate.isActive) return null
    if (!(await bcrypt.compare(rawPassword, candidate.passwordHash))) return null
  }

  const memberships = await loadActiveMemberships(candidate.id)
  const membership = pickMembership(memberships, prefer)
  // Authenticated, but no company will have them: an offboarded employee, a
  // revoked client, or a suspended/lapsed tenant. Indistinguishable from a bad
  // password on purpose.
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

// ---------------------------------------------------------------------------
// NextAuth v5 configuration object
// ---------------------------------------------------------------------------
export const authOptions: NextAuthConfig = {
  // No database adapter: sessions are JWT-based and OAuth sign-ins are gated to
  // pre-existing employees in the `signIn` callback below (we never auto-create
  // users). A `User` model now exists (M2) but Account/Session still map to
  // Employee, so the PrismaAdapter's assumptions still do not hold.
  session: { strategy: "jwt" },

  // Self-hosted behind a reverse proxy / accessed by IP or custom domain (not
  // Vercel), so we must explicitly trust the incoming host. Without this,
  // Auth.js v5 rejects every request with `UntrustedHost`.
  trustHost: true,

  secret: process.env.AUTH_SECRET,

  // error -> /login so auth failures show a toast on the login page instead of
  // the default Auth.js "Access Denied" screen.
  pages: { signIn: "/login", error: "/login" },

  providers: [
    // -----------------------------------------------------------------------
    // The one login. Staff and portal clients both authenticate here, against
    // `users`. Which surface they land on is decided by the membership, not by
    // the form they used.
    // -----------------------------------------------------------------------
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (c) => authorizeWithIdentity(c?.email, c?.password, "STAFF"),
    }),

    // -----------------------------------------------------------------------
    // Google OAuth - only employees whose email already exists in the DB may
    // sign in. Self-registration is not allowed in this internal DNMS.
    // -----------------------------------------------------------------------
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
    // -----------------------------------------------------------------------
    // signIn - gate Google logins to known, active employees with a live
    // membership.
    // -----------------------------------------------------------------------
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Returning a URL string denies the sign-in AND redirects there, so the
        // login page can show a specific toast (no account vs deactivated).
        if (!user.email) return "/login?error=no_account"

        const platformUser = await findLoginUser(user.email)
        if (!platformUser) return "/login?error=no_account"
        if (!platformUser.isActive) return "/login?error=deactivated"

        const membership = pickMembership(await loadActiveMemberships(platformUser.id), "STAFF")
        // Google is a staff door only - a client-only account signing in with it
        // has no staff surface to land on.
        if (!membership || membership.kind !== "STAFF") return "/login?error=no_account"

        // Align the OAuth user id with the employee id so the JWT callback can
        // look up roles & permissions using a consistent identifier.
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

    // -----------------------------------------------------------------------
    // JWT.
    //
    // Three paths:
    //   - first sign-in (`user` present)    → hydrate everything
    //   - session.update()                  → re-hydrate everything
    //   - every other request               → return as-is, EXCEPT once every
    //     15 minutes, when the membership is re-checked (below)
    //
    // ── WHY THE RUNTIME GUARD BELOW EXISTS ────────────────────────────────
    // This callback also runs inside proxy.ts, which is EDGE. `db` is a pg Pool
    // and cannot open a socket there: a query from the Edge throws, and since
    // the proxy runs on every request, that would take the whole app down
    // rather than fail one page.
    //
    // It has never mattered until now because the only DB work here fired on
    // sign-in or session.update(), both of which happen in route handlers (Node).
    // The 15-minute re-check is TIME-triggered, so it WOULD fire on the Edge.
    // Hence: on the Edge the token passes through untouched - exactly today's
    // behaviour - and every re-check happens on Node, where route handlers and
    // server actions can also persist the refreshed cookie.
    // -----------------------------------------------------------------------
    async jwt({ token, user, trigger, session }) {
      const now = Date.now()
      const onEdge = process.env.NEXT_RUNTIME === "edge"

      // --- Switch workspace (M3) -------------------------------------------
      //
      // /select-workspace calls update({ membershipId }) to move an existing
      // session to another company. The requested membership is re-read and
      // checked to belong to THIS user before anything is written: `session`
      // here is a payload from the browser, so it is a request, not a fact.
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
        // Someone else's membership, or one that is no longer valid. Leave the
        // token exactly as it was rather than failing the request - the page
        // re-reads the session and will show it did not move.
        if (target && owned) {
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

      // --- First sign-in ---------------------------------------------------
      if (user?.membershipId) {
        // authorizeWithIdentity() and the Google signIn callback both set all
        // four together. If one is missing the identity did not resolve, and a
        // token without a tenant is not a token we can safely issue.
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
        token.checkedAt = now
        return token
      }

      // --- Upgrade a token issued before M2 ---------------------------------
      //
      // Everyone already signed in when this deploys holds a token with no
      // membershipId. Left alone it would keep working (nothing reads the new
      // fields yet) but would never reach the re-check below, so those sessions
      // would stay unrevokable until they expired. Resolve the membership from
      // the profile id the old token does carry, and they join the new regime on
      // their very next request.
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
        // No membership for a profile the token claims to be: the account is
        // gone. Fail closed - this is the auth path.
        if (!existing) return null
        token.membershipId = existing.id
        token.userId = existing.userId
        // checkedAt is left unset so the re-check below runs immediately rather
        // than 15 minutes from now - the first thing an upgraded token should do
        // is confirm it is still entitled to what it is carrying.
      }

      // --- Explicit re-hydration, or the 15-minute re-check ------------------
      //
      // The re-check is what makes revocation actually take effect. Before M2 a
      // token carried its grants until it expired, so removing someone's role -
      // or deactivating them outright - left them holding it. Now the worst case
      // is 15 minutes, and a membership that has gone away ends the session.
      const membershipId = token.membershipId as string | undefined
      const stale = now - ((token.checkedAt as number | undefined) ?? 0) > MEMBERSHIP_RECHECK_MS

      if (!onEdge && membershipId && (trigger === "update" || stale)) {
        const membership = await loadMembershipIfStillValid(membershipId)
        // Deactivated, offboarded, or their company was suspended: returning
        // null invalidates the session cookie, so the next request is signed out.
        if (!membership) return null

        const profile = await hydrateFromMembership(membership)
        if (!profile) return null

        Object.assign(token, profile)
        token.tenantId = membership.tenantId
        token.tenantSlug = membership.tenantSlug
        // Carried on the membership row, so this costs no extra query.
        token.mustChangePassword = membership.mustChangePassword
        token.checkedAt = now
      }

      return token
    },

    // -----------------------------------------------------------------------
    // Session - copy JWT fields onto the session.user object exposed to
    // client components via useSession() and to server components via auth().
    // -----------------------------------------------------------------------
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
    // -----------------------------------------------------------------------
    // signIn event - stamp last-seen and write an audit entry. Non-critical: a
    // failure here must never block the login itself.
    // -----------------------------------------------------------------------
    async signIn({ user }) {
      if (!user?.id) return
      // The audit entry and the client activity row belong to the company the
      // person just signed in to, so ENTER that tenant rather than running
      // unscoped - authorize() has already resolved it onto `user`.
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
          // Non-critical - never block a login on a bookkeeping write.
        }
      }

      // Client sign-ins: they must NOT reach the audit log write below -
      // AuditLog.actorId is a foreign key into `employees`, so a client id there
      // is a constraint violation, not a log entry.
      if (user.kind === "client") {
        try {
          await db.clientUser.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
          // Their OWN log, which the portal's Activity view reads. Sign-ins are
          // the entries that make an activity log worth opening: they are how
          // somebody notices a session they did not start.
          await db.clientActivityLog.create({
            data: {
              clientUserId: user.id,
              action: "auth:signin",
              module: "auth",
              summary: "Signed in to the portal",
            },
          })
        } catch {
          // Non-critical - never block a login on a bookkeeping write.
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
        // Intentionally swallowed - audit log failure must not block login.
      }
    },
  },
}

// ---------------------------------------------------------------------------
// Initialise NextAuth v5 and re-export the universal `auth` helper together
// with the HTTP route handlers. Other modules (lib/auth.ts, proxy.ts,
// and the [...nextauth] route handler) import from here.
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
