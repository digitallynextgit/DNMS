import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { forEachTenant } from "@/server/tenant-jobs"
import type { TenantContext } from "@/server/tenant-context"

// =============================================================================
// The ONE cron authentication gate.
// =============================================================================
// Every /api/cron/* route calls assertCron(req) first. It replaces two
// hand-rolled idioms that had drifted apart (SEC-03 / SEC-06 / DUP-02):
//
//   - `if (secret) { check }`      -> SKIPPED the check entirely when the env
//                                     var was unset: fully open jobs.
//   - `!== `Bearer ${secret}``     -> accepted the literal "Bearer undefined"
//                                     when unset, and compared non-constant-time.
//
// This gate FAILS CLOSED: a missing CRON_SECRET means nothing runs, and the
// comparison is constant-time. One definition, one behaviour, for all cron jobs.
// =============================================================================

/**
 * Returns a 401 NextResponse when the request is NOT an authorized cron call,
 * or `null` when it is. Usage at the top of a cron handler:
 *
 *   const denied = assertCron(req)
 *   if (denied) return denied
 */
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET

  // Fail closed: with no secret configured, refuse rather than run unauthenticated.
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set - refusing to run the job.")
    return NextResponse.json({ error: "Cron is not configured" }, { status: 401 })
  }

  const provided = req.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch; compare lengths first (that only
  // leaks the length, not the content) and short-circuit.
  const ok = a.length === b.length && timingSafeEqual(a, b)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  return null
}

/**
 * Authenticate a cron call AND run its work once per tenant (M4).
 *
 *   export const GET = withCron("leave-accrual", async (req) => {
 *     const year = Number(req.nextUrl.searchParams.get("year")) || thisYear()
 *     return await runMonthlyAccrual(year)   // returns DATA, not a Response
 *   })
 *
 * The handler returns a plain value; the envelope is built here. Inside it, `db`
 * is scoped to one tenant, so the job body reads exactly as it did when there
 * was only ever one company - which is why adopting this required no changes to
 * the services themselves.
 *
 * Before this, every cron job swept whole tables in a single pass. Harmless with
 * one customer; with two it would have mailed Acme's reminders to Digitally
 * Next's staff.
 *
 * The response shape changed from each job's own ad-hoc body to a per-tenant
 * summary. Nothing in the app calls these endpoints - only the external
 * scheduler, which needs a 2xx - so the shape is free to say something useful.
 */
export function withCron<T>(
  job: string,
  handler: (req: NextRequest, tenant: TenantContext) => Promise<T>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const denied = assertCron(req)
    if (denied) return denied
    const summary = await forEachTenant(job, (tenant) => handler(req, tenant))
    // 200 even when a tenant failed: the sweep itself ran, and `failed` says
    // what did not. A 500 here would make the scheduler retry the whole thing,
    // re-running it for every tenant that already succeeded.
    return NextResponse.json({ ranAt: new Date().toISOString(), ...summary })
  }
}
