// =============================================================================
// In-memory sliding-window rate limiter.
// =============================================================================
// Process-local (per server instance), zero-dependency. Good enough for abuse
// control on unauthenticated endpoints - password reset, public careers - where
// the goal is to stop floods and fast enumeration, not to be a distributed quota.
// Behind multiple instances each holds its own window; tighten limits or move to
// a shared store (Redis) if that ever matters.
//
// Extracted so the same limiter backs every such endpoint instead of each one
// re-implementing the Map-of-timestamps (see the careers write route, which had
// its own copy).
// =============================================================================

const buckets = new Map<string, number[]>()

/**
 * Records a hit for `key` and returns true if it now exceeds `limit` within the
 * trailing `windowMs`. Opportunistically evicts stale keys so the Map cannot
 * grow without bound.
 */
export function rateLimited(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  recent.push(now)
  buckets.set(key, recent)

  if (buckets.size > 5_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return recent.length > limit
}

/**
 * Best-effort client IP for rate-limit keys.
 *
 * X-Real-IP first: nginx SETS it from the socket address, so a client cannot
 * forge it through our proxy. Then the LAST X-Forwarded-For hop - the one hop
 * appended by the proxy in front of us; the FIRST hop is whatever the client
 * sent and taking it let an attacker rotate the limiter key per request.
 * Behind more than one trusted proxy, adjust to hops-from-the-end.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  const fwd = req.headers.get("x-forwarded-for")
  const last = fwd?.split(",").at(-1)?.trim()
  return last || "unknown"
}
