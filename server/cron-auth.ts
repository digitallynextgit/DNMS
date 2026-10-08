import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { forEachTenant } from "@/server/tenant-jobs"
import type { TenantContext } from "@/server/tenant-context"

/**
 * The one cron auth gate: a 401 response, or null when authorized. Fails CLOSED when
 * CRON_SECRET is unset, and compares in constant time.
 */
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error("[cron] CRON_SECRET is not set - refusing to run the job.")
    return NextResponse.json({ error: "Cron is not configured" }, { status: 401 })
  }

  const provided = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch; checking length first only leaks the length.
  const ok = a.length === b.length && timingSafeEqual(a, b)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return null
}

/**
 * Authenticate a cron call, then run the handler once per tenant (with `db` scoped to it).
 * The handler returns data, not a Response; the reply is a per-tenant summary.
 */
export function withCron<T>(
  job: string,
  handler: (req: NextRequest, tenant: TenantContext) => Promise<T>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const denied = assertCron(req)
    if (denied) return denied
    const summary = await forEachTenant(job, (tenant) => handler(req, tenant))
    // 200 even if a tenant failed: a 500 would make the scheduler re-run every tenant.
    return NextResponse.json({ ranAt: new Date().toISOString(), ...summary })
  }
}
