import type { DefaultSession } from "next-auth"

/** "employee" = staff (roles + scopes); "client" = portal account (no grants). */
export type SessionKind = "employee" | "client"

declare module "next-auth" {
  interface Session {
    user: {
      /** The PROFILE id (`employees` or `client_users`); the person is `userId`. */
      id: string
      email: string
      kind: SessionKind
      /** The `users` row - the person, independent of company or capacity. */
      userId: string
      membershipId: string
      tenantId: string
      /** URL segment, e.g. "digitallynext". */
      tenantSlug: string
      /** Empty string for clients. */
      employeeNo: string
      /** For a client this holds their full name; lastName is empty. */
      firstName: string
      lastName: string
      /** The client's own company. Null for employees. */
      company: string | null
      profilePhoto: string | null
      /** Always empty for clients. */
      roles: string[]
      /** Always empty for clients. */
      permissions: string[]
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }

  /** Returned by the `authorize` callbacks; carries the resolved identity into the JWT. */
  interface User {
    kind?: SessionKind
    userId?: string
    membershipId?: string
    tenantId?: string
    tenantSlug?: string
    mustChangePassword?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    kind: SessionKind
    userId: string
    membershipId: string
    tenantId: string
    tenantSlug: string
    employeeNo: string
    firstName: string
    lastName: string
    company: string | null
    profilePhoto: string | null
    roles: string[]
    permissions: string[]
    mustChangePassword: boolean
    /** Epoch ms of the last membership re-check (re-run after 15 minutes). */
    checkedAt: number
    /** Epoch ms of the sign-in that proved the password. Never refreshed. */
    authAt: number
  }
}
