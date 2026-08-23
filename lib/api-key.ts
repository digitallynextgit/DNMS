import "server-only"

import { timingSafeEqual } from "node:crypto"

// =============================================================================
// The ONE API-key check for public/self-authenticating routes.
// =============================================================================
// Replaces two divergent implementations (a constant-time timingSafeEqual on the
// careers WRITE route and a plain `!==` on the READ route - DUP-09 / SEC-12).
// Constant-time so the compare does not leak the key by timing; length is
// pre-checked separately (that only leaks the length, which is not secret).

/** True only when `provided` exactly equals `expected`, compared constant-time. */
export function verifyApiKey(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
