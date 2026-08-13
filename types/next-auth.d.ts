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
      id: string
      email: string
      kind: SessionKind
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

  /** Returned by the `authorize` callbacks; carries `kind` into the JWT. */
  interface User {
    kind?: SessionKind
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    kind: SessionKind
    employeeNo: string
    firstName: string
    lastName: string
    company: string | null
    profilePhoto: string | null
    roles: string[]
    permissions: string[]
    mustChangePassword: boolean
  }
}
