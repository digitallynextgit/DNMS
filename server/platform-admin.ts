import "server-only"

import { auth } from "@/server/auth"
import { ForbiddenError } from "@/lib/errors"
import { normalizeEmail } from "@/server/identity"
import { FOUNDING_TENANT_ID } from "@/server/tenant-context"
import type { Session } from "next-auth"

// Platform admin (every tenant) is NOT a permission scope - every tenant's admin holds all scopes.
// It requires the founding tenant AND (the admin_ role OR an email in PLATFORM_ADMINS).
// An unset PLATFORM_ADMINS means nobody, never everyone.

function allowList(): Set<string> {
  const raw = process.env.PLATFORM_ADMINS ?? ""
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean),
  )
}

/** `admin_` and `admin` hold the same scopes; only `admin_` may also administer the platform. */
const PLATFORM_ROLE = "admin_"

/**
 * For platform-global models with no tenantId (StorageAccount, AppSetting): `settings:write` alone
 * would let any tenant's admin read shared credentials. Weaker than isPlatformAdmin() on purpose.
 */
export function assertPlatformScope(session: Session): void {
  if (session.user.kind === "client" || session.user.tenantId !== FOUNDING_TENANT_ID) {
    throw new ForbiddenError("This configuration is managed by the platform operator")
  }
}

export function isPlatformAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false
  if (session.user.kind === "client") return false
  if (session.user.tenantId !== FOUNDING_TENANT_ID) return false

  // The role is the normal grant; the email list is the bootstrap and escape hatch.
  const roles = session.user.roles ?? []
  if (roles.includes(PLATFORM_ROLE)) return true

  const list = allowList()
  if (list.size === 0) return false
  return list.has(normalizeEmail(session.user.email))
}

export async function getPlatformAdminSession(): Promise<Session | null> {
  const session = (await auth()) as Session | null
  return isPlatformAdmin(session) ? session : null
}

export function platformAdminsConfigured(): boolean {
  return allowList().size > 0
}
