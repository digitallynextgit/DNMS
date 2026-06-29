import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "./db"
import type { NextAuthConfig } from "next-auth"

// ---------------------------------------------------------------------------
// Helper – load an employee's roles and flat permission scopes from the DB.
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
    // Credentials – email + bcrypt password
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
        }
      },
    }),

    // -----------------------------------------------------------------------
    // Google OAuth – only employees whose email already exists in the DB may
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
    // signIn – gate Google logins to known, active employees only.
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
    // JWT – on first sign-in (`user` is present) load all PBAC data from the
    // DB and embed it into the token. On subsequent requests, the token
    // already carries the data, so we just return it as-is.
    // -----------------------------------------------------------------------
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        // First call: hydrate the token from the database.
        const data = await getUserWithPermissions(user.id)
        if (data) {
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
        // session.update() after a forced password change: re-read the flag so the
        // proxy stops redirecting to /change-password.
        const fresh = await db.employee.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true },
        })
        if (fresh) token.mustChangePassword = fresh.mustChangePassword
      }
      return token
    },

    // -----------------------------------------------------------------------
    // Session – copy JWT fields onto the session.user object exposed to
    // client components via useSession() and to server components via auth().
    // -----------------------------------------------------------------------
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.employeeNo = token.employeeNo as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        session.user.profilePhoto = (token.profilePhoto as string | null) ?? null
        session.user.roles = (token.roles as string[]) ?? []
        session.user.permissions = (token.permissions as string[]) ?? []
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false
      }
      return session
    },
  },

  events: {
    // -----------------------------------------------------------------------
    // signIn event – write an audit log entry. Non-critical: a failure here
    // must never block the login itself.
    // -----------------------------------------------------------------------
    async signIn({ user }) {
      if (!user?.id) return
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
        // Intentionally swallowed – audit log failure must not block login.
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
