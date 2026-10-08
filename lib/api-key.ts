import "server-only"

import { timingSafeEqual } from "node:crypto"

/** Constant-time compare. The length pre-check only leaks the length, which isn't secret. */
export function verifyApiKey(provided: string | null | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
