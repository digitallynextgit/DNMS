import "server-only"

import { auth } from "@/server/auth"
import { ForbiddenError } from "@/lib/errors"
import { normalizeEmail } from "@/server/identity"
import { FOUNDING_TENANT_ID } from "@/server/tenant-context"
import type { Session } from "next-auth"

// =============================================================================
// Who may administer the PLATFORM, as opposed to a company (M5).
//
// A tenant admin runs their own company: they hold every permission scope
// inside it, and none of them mean anything outside it. Administering the
// platform - seeing every customer, suspending one, changing a plan - is a
// different job, and giving it to whoever happens to hold `admin` somewhere
// would mean every customer's admin could see every other customer.
//
// So it is NOT a permission scope. It is an explicit allow-list of email
// addresses in the environment, plus the requirement that the person is signed
// in to the founding tenant. Two independent conditions, both required:
//
//   - PLATFORM_ADMINS  a comma-separated list of addresses
//   - the session's tenant is Digitally Next
//
// The second condition is what stops a stolen or mistakenly-issued account at
// another company from mattering, and it means adding an address to the list is
// not, by itself, enough to hand over the platform.
//
// UNSET means NOBODY. Never "everyone", and never "fall back to tenant admins".
// =============================================================================

function allowList(): Set<string> {
  const raw = process.env.PLATFORM_ADMINS ?? ""
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  )
}

/**
 * The role that means "DNMS staff", as opposed to "an admin of some company".
 *
 * `admin_` and `admin` carry the SAME 39 scopes and always have - both are full
 * administrators OF A TENANT. What separates them is this file: `admin_` is
 * additionally allowed to administer the platform itself (tenants, plans,
 * subscriptions), and `admin` never is.
 *
 * Until now that distinction lived only in an environment variable, so the two
 * roles were indistinguishable in the database and the difference was invisible
 * to anyone reading the code. The role is now the primary signal.
 */
const PLATFORM_ROLE = "admin_"

/**
 * Guard for routes that manage PLATFORM-GLOBAL state - models with no tenantId
 * (StorageAccount, AppSetting). `settings:write` is a TENANT-level scope that
 * every customer's own admin holds, so on its own it would let a second
 * tenant's admin read the shared storage credentials, mint signed URLs into
 * the founding tenant's bucket, or rewrite the platform mailer config. Until
 * those models carry a tenantId, they belong to the founding tenant's admins
 * alone. Deliberately weaker than isPlatformAdmin(): the Integrations page is
 * day-to-day admin work, not tenant lifecycle management.
 */
export function assertPlatformScope(session: Session): void {
  if (session.user.kind === "client" || session.user.tenantId !== FOUNDING_TENANT_ID) {
    throw new ForbiddenError("This configuration is managed by the platform operator")
  }
}

export function isPlatformAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false
  // A portal client is never platform staff, whatever else is true.
  if (session.user.kind === "client") return false
  // Platform staff are employees OF Digitally Next. A tenant's own admin holds
  // the same scopes inside their own workspace and must never reach this.
  if (session.user.tenantId !== FOUNDING_TENANT_ID) return false

  // EITHER signal grants access, and both are deliberate:
  //
  //   the role  - the durable one. Granting platform access is now an ordinary
  //               role assignment, visible in the admin UI and in the audit log.
  //   the list  - the bootstrap and the escape hatch. It works when the role
  //               table is wrong, which is exactly when you need it, and it is
  //               how the first platform admin exists before anyone can grant
  //               the role.
  const roles = session.user.roles ?? []
  if (roles.includes(PLATFORM_ROLE)) return true

  const list = allowList()
  if (list.size === 0) return false
  return list.has(normalizeEmail(session.user.email))
}

/** The session, or null when this person may not administer the platform. */
export async function getPlatformAdminSession(): Promise<Session | null> {
  const session = (await auth()) as Session | null
  return isPlatformAdmin(session) ? session : null
}

/** True when nobody has been nominated, so the console can explain itself. */
export function platformAdminsConfigured(): boolean {
  return allowList().size > 0
}
