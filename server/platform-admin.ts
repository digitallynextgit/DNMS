import "server-only"

import { auth } from "@/server/auth"
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

export function isPlatformAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false
  if (session.user.kind === "client") return false
  if (session.user.tenantId !== FOUNDING_TENANT_ID) return false
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
