import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"

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
