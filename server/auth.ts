import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "./db"
import type { NextAuthConfig } from "next-auth"

// ---------------------------------------------------------------------------
// Helper - load an employee's roles and flat permission scopes from the DB.
// ---------------------------------------------------------------------------
async function getUserWithPermissions(employeeId: string) {
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
  return db.clientUser.findUnique({
    where: { id: clientUserId },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      isActive: true,
      mustChangePassword: true,
    },
  })
}

/** The provider id for client sign-in - referenced by the portal login form. */
export const CLIENT_PROVIDER_ID = "client-credentials"

// ---------------------------------------------------------------------------
// NextAuth v5 configuration object
// ---------------------------------------------------------------------------
export const authOptions: NextAuthConfig = {
  // No database adapter: sessions are JWT-based and OAuth sign-ins are gated to
  // pre-existing employees in the `signIn` callback below (we never auto-create
  // users). The Prisma schema has no `User` model - Account/Session map to
  // Employee - so the PrismaAdapter, which calls `db.user`, cannot be used.
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
    // Credentials - email + bcrypt password
    // -----------------------------------------------------------------------
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const employee = await db.employee.findUnique({
          where: { email: credentials.email as string },
          // passwordHash is globally omitted (see server/db.ts) - opt back in here,
          // the one place that must compare it.
          omit: { passwordHash: false },
        })

        if (!employee || !employee.passwordHash || !employee.isActive) {
          return null
        }

        const isValid = await bcrypt.compare(credentials.password as string, employee.passwordHash)
        if (!isValid) return null

        // Return a minimal user object; JWT callback hydrates the rest.
        return {
          id: employee.id,
          email: employee.email,
          name: `${employee.firstName} ${employee.lastName}`,
          kind: "employee" as const,
        }
      },
    }),

    // -----------------------------------------------------------------------
    // Client credentials - external client accounts (client_users), used by the
    // /client-login page. A SEPARATE provider on purpose: it must be impossible
    // for a client password to be checked against the employee table, or for a
    // client to end up with a staff token. Password-only (no Google): these are
    // accounts we provision, not self-service sign-ups.
    // -----------------------------------------------------------------------
    Credentials({
      id: CLIENT_PROVIDER_ID,
      name: "client",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const client = await db.clientUser.findUnique({
          where: { email: (credentials.email as string).toLowerCase().trim() },
          // passwordHash is globally omitted (server/db.ts) - opt back in here.
          omit: { passwordHash: false },
        })

        // No password set yet = invited but never activated; treat as no account
        // rather than letting an empty compare decide.
        if (!client || !client.passwordHash || !client.isActive) return null

        const isValid = await bcrypt.compare(credentials.password as string, client.passwordHash)
        if (!isValid) return null

        return {
          id: client.id,
          email: client.email,
          name: client.name,
          kind: "client" as const,
        }
      },
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
    // signIn - gate Google logins to known, active employees only.
    // -----------------------------------------------------------------------
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Returning a URL string denies the sign-in AND redirects there, so the
        // login page can show a specific toast (no account vs deactivated).
        if (!user.email) return "/login?error=no_account"

        const employee = await db.employee.findUnique({
          where: { email: user.email },
          select: { id: true, isActive: true },
        })

        if (!employee) return "/login?error=no_account"
        if (!employee.isActive) return "/login?error=deactivated"

        // Align the OAuth user id with our employee id so the JWT callback
        // can look up roles & permissions using a consistent identifier.
        user.id = employee.id
      }
      return true
    },

    // -----------------------------------------------------------------------
    // JWT - on first sign-in (`user` is present) load all PBAC data from the
    // DB and embed it into the token. On subsequent requests, the token
    // already carries the data, so we just return it as-is.
    // -----------------------------------------------------------------------
    async jwt({ token, user, trigger, account }) {
      // --- External client accounts ---------------------------------------
      // Handled first and returned early so a client token can NEVER pick up
      // roles or permissions further down: an empty `permissions` array is what
      // makes every staff-side check fail for them.
      const isClient =
        account?.provider === CLIENT_PROVIDER_ID ||
        user?.kind === "client" ||
        token.kind === "client"

      if (isClient) {
        const id = (user?.id ?? token.id) as string | undefined
        if (id && (user?.id || trigger === "update")) {
          const client = await getClientForToken(id)
          if (client) {
            token.id = client.id
            token.kind = "client"
            token.firstName = client.name
            token.lastName = ""
            token.employeeNo = ""
            token.profilePhoto = null
            token.company = client.company ?? null
            token.roles = []
            token.permissions = []
            token.mustChangePassword = client.mustChangePassword
          }
        }
        // Belt and braces: whatever else happened, a client token carries no grants.
        token.kind = "client"
        token.roles = []
        token.permissions = []
        return token
      }

      if (user?.id) {
        // First call: hydrate the token from the database.
        const data = await getUserWithPermissions(user.id)
        if (data) {
          token.kind = "employee"
          token.id = data.employee.id
          token.employeeNo = data.employee.employeeNo
          token.firstName = data.employee.firstName
          token.lastName = data.employee.lastName
          token.profilePhoto = data.employee.profilePhoto ?? null
          token.roles = data.roles
          token.permissions = data.permissions
          token.mustChangePassword = data.employee.mustChangePassword
        }
      } else if (trigger === "update" && token.id) {
        // session.update() re-hydrates the whole token from the database.
        //
        // Two callers rely on this: a forced password change (the proxy must
        // stop redirecting to /change-password) and a role change made against
        // your own account - permissions are READ FROM THIS TOKEN, so without
        // this the sidebar and every `can()` check keep the grants you signed
        // in with until the next sign-in.
        const data = await getUserWithPermissions(token.id as string)
        if (data) {
          token.roles = data.roles
          token.permissions = data.permissions
          token.mustChangePassword = data.employee.mustChangePassword
        }
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
    // signIn event - write an audit log entry. Non-critical: a failure here
    // must never block the login itself.
    // -----------------------------------------------------------------------
    async signIn({ user, account }) {
      if (!user?.id) return

      // Client sign-ins: stamp last-seen and stop. They must NOT reach the audit
      // log write below - AuditLog.actorId is a foreign key into `employees`, so
      // a client id there is a constraint violation, not a log entry.
      if (account?.provider === CLIENT_PROVIDER_ID || user.kind === "client") {
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
// with the HTTP route handlers. Other modules (lib/auth.ts, middleware.ts,
// and the [...nextauth] route handler) import from here.
// ---------------------------------------------------------------------------
export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
