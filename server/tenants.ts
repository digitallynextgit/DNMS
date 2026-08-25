import "server-only"

import { db } from "@/server/db"
import { GLOBAL_SEGMENTS, SLUG_PATTERN, TENANT_SCOPED_SEGMENTS } from "@/lib/tenant-url"
import {
  FOUNDING_TENANT_ID,
  FOUNDING_TENANT_SLUG,
  type TenantContext,
} from "@/server/tenant-context"

// =============================================================================
// Tenant lookup + the slug rules.
//
// Slugs live in the URL as the first path segment
// (dnms.digitallynext.com/{slug}/dashboard), so a slug can never collide with a
// path the app already serves. RESERVED_SLUGS is that guard, and it is also
// what lets old, unprefixed URLs keep working: because every legacy segment is
// reserved, "/dashboard" can only ever mean the legacy route, never a company.
// =============================================================================

export type TenantStatus = "ACTIVE" | "SUSPENDED" | "READ_ONLY"

export interface TenantRecord {
  id: string
  slug: string
  name: string
  status: string
  plan: string
  trialEndsAt: Date | null
}

const TENANT_SELECT = {
  id: true,
  slug: true,
  name: true,
  status: true,
  plan: true,
  trialEndsAt: true,
} as const

/**
 * Every first path segment the app already serves, plus names we must not let a
 * customer claim. Checked at signup AND in the proxy.
 *
 * The route segments come from `lib/tenant-url.ts`, which is also what the proxy
 * and every link use to decide what a slug is. Keeping one list means a route
 * added there can never become claimable here by omission.
 *
 * Added on top of those:
 *   - `account`, `sitemap`, `robots` - reachable or reserved names that are not
 *     themselves routing segments
 *   - top-level entries in public/
 *   - brand-protection names
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...TENANT_SCOPED_SEGMENTS,
  ...GLOBAL_SEGMENTS,
  // Not routing segments, but must not be claimable.
  "account",
  "sitemap",
  "robots",
  // public/ entries
  "avatars",
  "email-icons",
  // brand protection
  "www",
  "mail",
  "app",
  "blog",
  "status",
  "support",
  "billing",
  "help",
  "docs-api",
  "static",
  "assets",
])

export { SLUG_PATTERN }

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug)
}

/** Why a slug was rejected, for the signup form. Null when it is acceptable. */
export function slugRejectionReason(slug: string): string | null {
  if (!SLUG_PATTERN.test(slug)) {
    return "Use 3-32 characters: lowercase letters, numbers and hyphens, not starting or ending with a hyphen."
  }
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved. Please choose another."
  return null
}

export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  if (!SLUG_PATTERN.test(slug)) return null
  return db.tenant.findUnique({ where: { slug }, select: TENANT_SELECT })
}

export async function getTenantById(id: string): Promise<TenantRecord | null> {
  return db.tenant.findUnique({ where: { id }, select: TENANT_SELECT })
}

/** Digitally Next. Every row that existed before tenancy belongs to it. */
export async function getFoundingTenant(): Promise<TenantRecord> {
  const tenant = await getTenantById(FOUNDING_TENANT_ID)
  if (!tenant)
    throw new Error(
      "The founding tenant is missing - migration 20260825000000_tenant_spine did not run.",
    )
  return tenant
}

export function toContext(tenant: TenantRecord): TenantContext {
  return { tenantId: tenant.id, slug: tenant.slug }
}

/** A tenant may serve requests: exists, ACTIVE, and not past a trial. */
export function isServable(tenant: TenantRecord): boolean {
  if (tenant.status !== "ACTIVE") return false
  if (tenant.plan === "TRIAL" && tenant.trialEndsAt && tenant.trialEndsAt.getTime() < Date.now())
    return false
  return true
}

export { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG }
