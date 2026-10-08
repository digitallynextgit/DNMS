// In-memory sliding-window limiter for unauthenticated endpoints. Per process: each instance keeps
// its own window, so move to Redis if that ever matters.

const buckets = new Map<string, number[]>()

/** Records a hit; true if `key` is now over `limit` within `windowMs`. Evicts stale keys as it goes. */
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
 * X-Real-IP first (nginx sets it, so it can't be forged), then the LAST X-Forwarded-For hop - the
 * first is client-supplied. Adjust if there's more than one trusted proxy.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  const fwd = req.headers.get("x-forwarded-for")
  const last = fwd?.split(",").at(-1)?.trim()
  return last || "unknown"
}
