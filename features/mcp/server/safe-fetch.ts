import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

// =============================================================================
// SSRF guard + capped fetch, shared by everything in the AI connector that
// fetches a URL on a caller's say-so (an app's client-metadata document, a
// storage link a DNMS route handed back).
//
// A URL we did not write ourselves must never be allowed to point the server
// at itself or at the private network (cloud metadata, localhost services, the
// database host...).
// =============================================================================

export class UnsafeUrlError extends Error {}

export async function assertPublicHost(hostname: string): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "")
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address)
  if (addresses.length === 0) throw new UnsafeUrlError("The host does not resolve")
  if (addresses.some(isPrivateAddress)) throw new UnsafeUrlError("The host is not public")
}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip)
  if (v === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (v === 6) {
    const lower = ip.toLowerCase()
    if (lower === "::" || lower === "::1") return true
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true
    if (/^fe[89ab]/.test(lower)) return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped?.[1]) return isPrivateAddress(mapped[1])
    return false
  }
  return true
}

/**
 * Fetch a public https URL, refusing redirects and anything bigger than
 * `maxBytes`. Returns the bytes and the response headers.
 */
export async function fetchPublicCapped(
  url: string,
  maxBytes: number,
  timeoutMs = 20_000,
): Promise<{ bytes: Uint8Array; headers: Headers }> {
  const u = new URL(url)
  if (u.protocol !== "https:") throw new UnsafeUrlError("Only https links can be fetched")
  await assertPublicHost(u.hostname)
  const res = await fetch(u, {
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  })
  if (!res.ok) throw new UnsafeUrlError(`The file host answered ${res.status}`)
  const declared = Number(res.headers.get("content-length") ?? 0)
  if (declared > maxBytes) throw new UnsafeUrlError("The file is too large")
  const reader = res.body?.getReader()
  if (!reader) return { bytes: new Uint8Array(), headers: res.headers }
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new UnsafeUrlError("The file is too large")
    }
    chunks.push(value)
  }
  return { bytes: new Uint8Array(Buffer.concat(chunks)), headers: res.headers }
}
