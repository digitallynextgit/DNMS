import "server-only"

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { publicOrigin } from "./config"

// =============================================================================
// Download links for files the AI connector produces.
//
// Claude and ChatGPT cannot receive a file through MCP, so the tool hands back
// a link instead and the person clicks it. The link:
//   - is signed (HMAC with a key derived from AUTH_SECRET), so it cannot be
//     forged or edited,
//   - expires after 10 minutes,
//   - names the CONNECTION it was issued to - revoke the connection, or
//     deactivate the person, and the link dies with it; the route re-checks
//     both when it is opened,
//   - for generated files, points at a copy held in memory for those 10
//     minutes; a GET report can be rebuilt as the same person if the copy is
//     gone (a restart), a POST one cannot (it may have side effects).
//
// It is a capability link: anyone holding it can download THAT file until it
// expires - the same trade-off as any "share" link, kept short on purpose.
// =============================================================================

export const LINK_TTL_MS = 10 * 60 * 1000
/** One generated file may be at most this big; larger ones are refused. */
export const MAX_FILE_BYTES = 40 * 1024 * 1024
/** All held copies together. Oldest are dropped first. */
const MAX_CACHE_BYTES = 150 * 1024 * 1024

export interface LinkPayload {
  /** Connection (grant) id. */
  g: string
  /** Nonce - also the cache key. */
  n: string
  /** Expiry, epoch ms. */
  e: number
  /** HTTP method that produced the file. */
  m: "GET" | "POST"
  /** Path + query, so a GET file can be rebuilt. */
  p: string
  /** File name to download as. */
  f: string
  /** Content type. */
  t: string
}

function key(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set - cannot sign download links")
  return createHmac("sha256", secret).update("dnms-mcp-download-link-v1").digest()
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url")

export function signLink(payload: LinkPayload): string {
  const body = b64(JSON.stringify(payload))
  const sig = createHmac("sha256", key()).update(body).digest()
  return `${body}.${b64(sig)}`
}

/** The payload if the token is genuine and unexpired, else null. */
export function verifyLink(token: string): LinkPayload | null {
  const [body, sig, extra] = token.split(".")
  if (!body || !sig || extra !== undefined) return null
  const expected = createHmac("sha256", key()).update(body).digest()
  const given = Buffer.from(sig, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LinkPayload
    if (typeof p.g !== "string" || typeof p.n !== "string" || typeof p.e !== "number") return null
    if (p.e < Date.now()) return null
    return p
  } catch {
    return null
  }
}

export const linkUrl = (token: string) => `${publicOrigin()}/api/mcp/files/${token}`

export const newNonce = () => randomBytes(12).toString("base64url")

// ---------------------------------------------------------------------------
// The short-lived copy store
// ---------------------------------------------------------------------------
interface Held {
  bytes: Uint8Array
  contentType: string
  fileName: string
  grantId: string
  expiresAt: number
}

const g = globalThis as unknown as { dnmsMcpFileCache?: Map<string, Held> }
// Pinned to globalThis so dev hot-reload does not orphan held files.
const cache: Map<string, Held> = (g.dnmsMcpFileCache ??= new Map())

function sweep(): void {
  const now = Date.now()
  let total = 0
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k)
    else total += v.bytes.byteLength
  }
  // Map keeps insertion order, so the first keys are the oldest.
  for (const k of cache.keys()) {
    if (total <= MAX_CACHE_BYTES) break
    total -= cache.get(k)!.bytes.byteLength
    cache.delete(k)
  }
}

export function holdFile(nonce: string, file: Omit<Held, "expiresAt">): void {
  sweep()
  cache.set(nonce, { ...file, expiresAt: Date.now() + LINK_TTL_MS })
}

export function heldFile(nonce: string, grantId: string): Held | null {
  const hit = cache.get(nonce)
  if (!hit || hit.expiresAt < Date.now() || hit.grantId !== grantId) return null
  return hit
}
