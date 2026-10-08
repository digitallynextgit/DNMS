import "server-only"

import { db } from "@/server/db"
import { GLOBAL_SEGMENTS, SLUG_PATTERN, TENANT_SCOPED_SEGMENTS } from "@/lib/tenant-url"
import {
  FOUNDING_TENANT_ID,
  FOUNDING_TENANT_SLUG,
  type TenantContext,
} from "@/server/tenant-context"

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
 * Slugs are the first URL segment, so every route segment (from lib/tenant-url.ts) is reserved,
 * plus other names a customer must not claim.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...TENANT_SCOPED_SEGMENTS,
  ...GLOBAL_SEGMENTS,
  "account",
  "sitemap",
  "robots",
  // public/ entries
  "avatars",
  "brand-masters",
  "email-icons",
  "help-shots",
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

/** Digitally Next. */
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
