// =============================================================================
// AI connector (MCP + OAuth 2.1) - shared constants. See docs/mcp-connector-plan.md.
// Client-safe: no server imports.
// =============================================================================

/** OAuth scopes DNMS issues. What a token can do = these ∩ the person's own DNMS permissions. */
export const MCP_SCOPES = {
  /** Read anything the person can read in DNMS. */
  READ: "hrms:read",
  /** Create / change / approve anything the person can in DNMS. */
  WRITE: "hrms:write",
} as const

export const SUPPORTED_SCOPES: readonly string[] = [MCP_SCOPES.READ, MCP_SCOPES.WRITE]

/** Granted when the app asks for nothing specific. */
export const DEFAULT_SCOPES: readonly string[] = [MCP_SCOPES.READ, MCP_SCOPES.WRITE]

/** Plain-language description of each scope for the consent screen. */
export const SCOPE_LABELS: Record<string, string> = {
  [MCP_SCOPES.READ]:
    "See everything you can see in DNMS - people, leave, attendance, payroll, projects and more",
  [MCP_SCOPES.WRITE]:
    "Make changes you are allowed to make - apply for or approve leave, update tasks, and so on",
}

export const TOKEN_PREFIX = {
  ACCESS: "dnms_at_",
  REFRESH: "dnms_rt_",
  CODE: "dnms_ac_",
  DCR_CLIENT: "dnms_dcr_",
} as const

export const LIFETIME = {
  /** Access token: 1 hour. Claude and ChatGPT refresh automatically. */
  ACCESS_MS: 60 * 60 * 1000,
  /** Refresh token: 30 days, rotated on every use - so idle 30 days = reconnect. */
  REFRESH_MS: 30 * 24 * 60 * 60 * 1000,
  /** A pending authorization request waiting for the person to log in and click Allow. */
  PENDING_MS: 10 * 60 * 1000,
  /** A one-time authorization code. */
  CODE_MS: 60 * 1000,
  /** Re-fetch a Client ID Metadata Document after this long. */
  CIMD_CACHE_MS: 24 * 60 * 60 * 1000,
} as const

/**
 * Where tokens may be delivered. Anything else is refused before a redirect is
 * ever issued, so a DNMS token can only reach Claude, ChatGPT, or a program on
 * the person's own machine (Claude Code, Codex, MCP Inspector - loopback).
 * Add more with the MCP_ALLOWED_REDIRECT_ORIGINS env var (comma separated).
 */
export const DEFAULT_REDIRECT_ORIGINS: readonly string[] = [
  "https://claude.ai",
  "https://chatgpt.com",
]

/** Hosts we show as "Verified" on the consent screen. */
export const VERIFIED_CLIENT_HOSTS: Record<string, string> = {
  "claude.ai": "Claude",
  "chatgpt.com": "ChatGPT",
}
