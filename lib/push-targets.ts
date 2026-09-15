// =============================================================================
// Which browser registrations a push may be delivered to.
// =============================================================================
// PURE, and in its own module so it can be unit-tested: lib/web-push.ts is
// server-only and cannot be imported by a test.
//
// ── THE PROBLEM ─────────────────────────────────────────────────────────────
// A Web Push endpoint is a URL at the browser vendor (fcm.googleapis.com), never
// at us, so a subscription row cannot say which site created it. A developer
// running localhost against the PRODUCTION DATABASE_URL therefore files their
// localhost registration into the same table as the real ones, and every
// notification goes out twice - once from the deployed site, once from a
// localhost service worker. That second copy keeps arriving after the dev server
// is stopped, because the service worker is installed in the BROWSER and wakes
// on push without ever contacting localhost.
// =============================================================================

/** Hosts that only ever mean "somebody's development machine". */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"])

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname
    return LOOPBACK_HOSTS.has(host) || host.endsWith(".local")
  } catch {
    return false
  }
}

/**
 * May a push from `appOrigin` be delivered to a subscription registered at
 * `subscriptionOrigin`?
 *
 * The rules, in order, each chosen so that a MISCONFIGURATION degrades to noisy
 * rather than silent - a missing environment variable must never switch
 * notifications off for a whole company:
 *
 *   1. A loopback registration is only ever reachable from a process whose own
 *      origin is that same loopback. This is the rule that kills the duplicate,
 *      and it holds even when nothing is configured.
 *   2. If we do not know our own origin, deliver to every non-loopback
 *      registration. Losing the origin means losing the ability to
 *      de-duplicate, not the ability to notify.
 *   3. Otherwise require an exact match. A NULL origin - a row written before
 *      the column existed - is NOT trusted: its origin is genuinely unknowable,
 *      and guessing is what produced the duplicate. Those rows heal on the
 *      browser's next visit, when registerPush() upserts the same endpoint and
 *      fills the column in.
 */
export function isPushDeliverable(
  subscriptionOrigin: string | null | undefined,
  appOrigin: string | null | undefined,
): boolean {
  if (subscriptionOrigin && isLoopbackOrigin(subscriptionOrigin)) {
    return Boolean(appOrigin) && subscriptionOrigin === appOrigin
  }
  if (!appOrigin) return true
  if (!subscriptionOrigin) return false
  return subscriptionOrigin === appOrigin
}
