import "server-only"

import { DEFAULT_REDIRECT_ORIGINS, VERIFIED_CLIENT_HOSTS } from "../constants"
import { extraRedirectOrigins } from "./config"

// Where an authorization code may go: a URI the client declared (loopback matches any port,
// RFC 8252 §7.3), AND on our allowlist (Claude, ChatGPT, loopback, MCP_ALLOWED_REDIRECT_ORIGINS).

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

function parse(uri: string): URL | null {
  try {
    return new URL(uri)
  } catch {
    return null
  }
}

export function isLoopbackRedirect(uri: string): boolean {
  const u = parse(uri)
  return !!u && u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname)
}

/** Is this redirect URI one we would ever deliver a code to? */
export function isAllowedRedirect(uri: string): boolean {
  const u = parse(uri)
  if (!u || u.hash) return false
  if (isLoopbackRedirect(uri)) return true
  if (u.protocol !== "https:" && !extraRedirectOrigins().some((p) => uri.startsWith(p))) {
    return false
  }
  const allowed = [...DEFAULT_REDIRECT_ORIGINS, ...extraRedirectOrigins()]
  return allowed.some((origin) => {
    // An entry is an origin (https://claude.ai) or a prefix (cursor://anysphere.cursor-mcp/oauth).
    const o = parse(origin)
    if (o && o.origin !== "null" && (o.pathname === "/" || o.pathname === "")) {
      return u.origin === o.origin
    }
    return uri.startsWith(origin)
  })
}

/** Does `requested` match one of the client's declared redirect URIs? */
export function redirectMatches(registered: readonly string[], requested: string): boolean {
  if (registered.includes(requested)) return true
  if (!isLoopbackRedirect(requested)) return false
  const r = parse(requested)!
  return registered.some((candidate) => {
    if (!isLoopbackRedirect(candidate)) return false
    const c = parse(candidate)!
    // Port-agnostic: same scheme, host, path and query; port may differ.
    return c.hostname === r.hostname && c.pathname === r.pathname && c.search === r.search
  })
}

/** The hostname to show on the consent screen (the spec requires showing it). */
export function redirectHost(uri: string): string {
  const u = parse(uri)
  if (!u) return uri
  if (isLoopbackRedirect(uri)) return "this computer (localhost)"
  return u.host || u.protocol.replace(/:$/, "")
}

/** "Claude" / "ChatGPT" when the code goes to one of their official callbacks. */
export function verifiedClientName(redirectUri: string): string | null {
  const u = parse(redirectUri)
  if (!u || u.protocol !== "https:") return null
  return VERIFIED_CLIENT_HOSTS[u.hostname] ?? null
}
