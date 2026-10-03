import "server-only"

// =============================================================================
// The public URLs of the AI connector.
//
// Everything here is built from ONE configured origin, never from `req.url`:
// behind nginx the request URL can carry http:// or the internal host (see the
// onThisOrigin comment in proxy.ts), and OAuth compares these strings exactly -
// the issuer in our metadata, the `iss` we return and the `resource` a token is
// bound to must all be byte-for-byte identical.
//
//   APP_PUBLIC_ORIGIN=https://dnms.digitallynext.com   (production)
//
// Falls back to NEXTAUTH_URL / NEXT_PUBLIC_APP_URL so local dev works unset.
// =============================================================================

export function publicOrigin(): string {
  const raw =
    process.env.APP_PUBLIC_ORIGIN ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  try {
    return new URL(raw).origin
  } catch {
    return raw.replace(/\/+$/, "")
  }
}

/** OAuth issuer identifier (RFC 8414 / RFC 9207). */
export const issuer = (): string => publicOrigin()

/** The MCP server's canonical URI - every access token is bound to exactly this. */
export const mcpResource = (): string => `${publicOrigin()}/api/mcp`

/** Protected Resource Metadata URL (RFC 9728, path-suffixed form). */
export const resourceMetadataUrl = (): string =>
  `${publicOrigin()}/.well-known/oauth-protected-resource/api/mcp`

export const oauthEndpoints = () => {
  const o = publicOrigin()
  return {
    authorization: `${o}/api/oauth/authorize`,
    token: `${o}/api/oauth/token`,
    registration: `${o}/api/oauth/register`,
    revocation: `${o}/api/oauth/revoke`,
  }
}

/** Extra redirect origins/prefixes allowed beyond Claude, ChatGPT and loopback. */
export function extraRedirectOrigins(): string[] {
  return (process.env.MCP_ALLOWED_REDIRECT_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}
