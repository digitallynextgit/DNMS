// Pure so it can be unit-tested (lib/web-push.ts is server-only). A push endpoint can't tell which
// site registered it, so localhost registrations on the prod DB would get every push twice.

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
 * Rules, chosen so a misconfiguration is noisy, never silent: loopback only reaches the same
 * loopback; an unknown app origin delivers to every non-loopback; otherwise an exact match. A NULL
 * origin isn't trusted - it heals when registerPush() runs again.
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
