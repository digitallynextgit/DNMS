import type { DefaultSession } from "next-auth"

/**
 * `kind` separates the two populations that can hold a session:
 *   "employee" - internal staff (Employee row, roles + permission scopes)
 *   "client"   - external client portal account (ClientUser row, no grants)
 *
 * Staff guards reject "client" and the portal guard rejects "employee", so the
 * two can never be mistaken for one another. Legacy tokens issued before this
 * field existed have no `kind` and are read as "employee" (see server/auth.ts).
 */
export type SessionKind = "employee" | "client"

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * The PROFILE id - an `employees` id for staff, a `client_users` id for a
       * portal client. Unchanged by M2 on purpose: the whole app keys off it.
       * For the platform identity behind it, use `userId`.
       */
      id: string
      email: string
      kind: SessionKind
      /** The `users` row - the person, independent of company or capacity (M2). */
      userId: string
      /** The `memberships` row this session is acting through (M2). */
      membershipId: string
      /** The company this session is scoped to (M2). */
      tenantId: string
      /** That company's URL segment, e.g. "digitallynext" (M2). */
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
    /**
     * Epoch ms of the last membership re-check. The JWT callback re-reads the
     * membership when this is older than 15 minutes, so revoking access takes
     * effect within that window instead of at the token's expiry.
     */
    checkedAt: number
  }
}
