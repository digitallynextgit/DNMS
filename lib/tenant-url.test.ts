import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  GLOBAL_SEGMENTS,
  TENANT_SCOPED_SEGMENTS,
  isTenantScoped,
  looksLikeSlug,
  splitTenant,
} from "./tenant-url"

/**
 * The invariant that keeps /{tenant}/... working.
 *
 * A dashboard route whose first segment is missing from TENANT_SCOPED_SEGMENTS
 * is read by looksLikeSlug() as a COMPANY NAME. The proxy then strips it, finds
 * a tenant that is not the session's, and bounces the user to
 * /select-workspace?next=... - so the page becomes unreachable for everyone.
 *
 * It happened to /avatars once (recorded in tenant-url.ts) and again to
 * /onboarding and /clearances when the HR checklists were added. The comments
 * in that file point at scripts/verify-tenant-urls.ts to prevent it, but that
 * script no longer exists - this test replaces it, and runs in `pnpm test`.
 */
describe("TENANT_SCOPED_SEGMENTS covers every dashboard route", () => {
  const dashboardDir = path.join(process.cwd(), "app", "(dashboard)")

  const segments = fs
    .readdirSync(dashboardDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    // Route groups add no URL segment, so they are never part of a path.
    .filter((e) => !e.name.startsWith("(") && !e.name.startsWith("_"))
    .map((e) => e.name)

  it("finds the dashboard routes at all (guards against a moved folder)", () => {
    expect(segments.length).toBeGreaterThan(10)
  })

  it.each(segments)("/%s is registered as tenant-scoped", (segment) => {
    expect(TENANT_SCOPED_SEGMENTS.has(segment)).toBe(true)
  })

  it.each(segments)("/%s is never mistaken for a company slug", (segment) => {
    expect(looksLikeSlug(segment)).toBe(false)
  })

  it.each(segments)("/%s survives splitTenant with no prefix", (segment) => {
    expect(splitTenant(`/${segment}`)).toEqual({ slug: null, rest: `/${segment}` })
  })
})

describe("segment sets", () => {
  it("never classifies a segment as both global and tenant-scoped", () => {
    const both = [...TENANT_SCOPED_SEGMENTS].filter((s) => GLOBAL_SEGMENTS.has(s))
    expect(both).toEqual([])
  })

  it("keeps a real slug looking like a slug", () => {
    expect(looksLikeSlug("digitallynext")).toBe(true)
    expect(splitTenant("/digitallynext/onboarding")).toEqual({
      slug: "digitallynext",
      rest: "/onboarding",
    })
  })

  it("routes the HR checklist paths through the tenant prefix", () => {
    expect(isTenantScoped("/onboarding")).toBe(true)
    expect(isTenantScoped("/clearances")).toBe(true)
    expect(isTenantScoped("/exit-clearance")).toBe(true)
  })

  it("leaves global paths unprefixed", () => {
    expect(isTenantScoped("/login")).toBe(false)
    expect(isTenantScoped("/api/hr-checklists")).toBe(false)
  })
})
