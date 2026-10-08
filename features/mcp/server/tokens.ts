import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

// Opaque tokens: 32 random bytes behind a recognisable prefix (easy to spot if leaked); only the
// SHA-256 is stored. Not JWT - revocation is instant and there are no keys to rotate.

export function generateToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/** RFC 7636 code_verifier: 43-128 chars of [A-Za-z0-9-._~]. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/

/** S256 only (OAuth 2.1 / MCP): BASE64URL(SHA256(verifier)) === challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) return false
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"))
  const expected = Buffer.from(challenge)
  return computed.length === expected.length && timingSafeEqual(computed, expected)
}

/** RFC 7636 code_challenge for S256 is always 43 base64url chars. */
export function isValidChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9\-_]{43}$/.test(challenge)
}
