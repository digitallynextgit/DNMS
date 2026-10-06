import "server-only"

import type { Session } from "next-auth"
import { db } from "@/server/db"
import { runUnscoped } from "@/server/tenant-context"
import { loadMembershipIfStillValid } from "@/server/identity"
import { createAuditLog } from "@/lib/audit"
import { DEFAULT_SCOPES, LIFETIME, SUPPORTED_SCOPES, TOKEN_PREFIX } from "../constants"
import { issuer, mcpResource } from "./config"
import { ClientError, resolveClient } from "./clients.service"
import { generateToken, isValidChallenge, pkceMatches, sha256Hex } from "./tokens"
import {
  isAllowedRedirect,
  isLoopbackRedirect,
  redirectHost,
  redirectMatches,
  verifiedClientName,
} from "./redirects"

// =============================================================================
// The OAuth 2.1 authorization server (authorization-code + PKCE S256 only).
//
//   GET  /api/oauth/authorize  → startAuthorization()   → /oauth/consent/<id>
//   Allow / Deny on the page   → approve/denyAuthorization() → back to the app
//   POST /api/oauth/token      → exchangeCode() / refreshTokens()
//   POST /api/oauth/revoke     → revokeToken()
//
// OAuthGrant is tenant-scoped, but these flows run BEFORE the company is known
// (the token is what decides it), so grant reads here go through runUnscoped -
// the same pattern sign-in uses.
// =============================================================================

/** OAuth error as returned by the token / revoke endpoints (RFC 6749 §5.2). */
export class OAuthFlowError extends Error {
  constructor(
    public readonly error: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message)
  }
}

const sameResource = (a: string, b: string) =>
  a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase()

function parseScopes(raw: string | null | undefined): string[] {
  const requested = (raw ?? "").split(/\s+/).filter((s) => SUPPORTED_SCOPES.includes(s))
  // `offline_access`, OIDC scopes and anything unknown are ignored rather than
  // refused - refresh tokens are always issued, and refusing would only break
  // clients that ask for a little extra.
  return requested.length ? Array.from(new Set(requested)) : [...DEFAULT_SCOPES]
}

/** Append OAuth response params to a redirect URI, keeping its own query. */
function withParams(uri: string, params: Record<string, string | null | undefined>): string {
  const url = new URL(uri)
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) url.searchParams.set(k, v)
  }
  return url.toString()
}

// ---------------------------------------------------------------------------
// 1. Authorization request
// ---------------------------------------------------------------------------

export type AuthorizeOutcome =
  | { type: "consent"; requestId: string }
  /** Error that can safely go back to the (validated) redirect URI. */
  | { type: "redirect"; url: string }
  /** Error shown on a DNMS page - the redirect URI is not trusted yet. */
  | { type: "error"; title: string; message: string }

export async function startAuthorization(sp: URLSearchParams): Promise<AuthorizeOutcome> {
  const clientId = sp.get("client_id") ?? ""
  const state = sp.get("state")

  let client
  try {
    client = await resolveClient(clientId)
  } catch (err) {
    return {
      type: "error",
      title: "Unknown app",
      message:
        err instanceof ClientError
          ? `DNMS could not identify the app that sent you here: ${err.message}.`
          : "DNMS could not identify the app that sent you here.",
    }
  }

  // redirect_uri: optional only when the client registered exactly one.
  let redirectUri = sp.get("redirect_uri")
  if (!redirectUri) {
    if (client.redirectUris.length !== 1) {
      return { type: "error", title: "Missing redirect", message: "redirect_uri is required." }
    }
    redirectUri = client.redirectUris[0]!
  }
  if (!redirectMatches(client.redirectUris, redirectUri)) {
    return {
      type: "error",
      title: "Redirect not registered",
      message: `${client.name} asked DNMS to send you to an address it never registered.`,
    }
  }
  if (!isAllowedRedirect(redirectUri)) {
    return {
      type: "error",
      title: "App not allowed",
      message: `${client.name} wants to sign in through ${redirectHost(redirectUri)}, which is not on DNMS's list of allowed AI apps. Ask your DNMS administrator to add it.`,
    }
  }

  // From here the redirect URI is trusted, so errors go back to the app.
  const back = (error: string, description: string): AuthorizeOutcome => ({
    type: "redirect",
    url: withParams(redirectUri!, {
      error,
      error_description: description,
      state,
      iss: issuer(),
    }),
  })

  if (sp.get("response_type") !== "code") {
    return back("unsupported_response_type", "Only response_type=code is supported")
  }
  const challenge = sp.get("code_challenge") ?? ""
  if (sp.get("code_challenge_method") !== "S256" || !isValidChallenge(challenge)) {
    return back("invalid_request", "PKCE with code_challenge_method=S256 is required")
  }
  const resource = sp.get("resource") || mcpResource()
  if (!sameResource(resource, mcpResource())) {
    return back("invalid_target", `This server only issues tokens for ${mcpResource()}`)
  }

  const row = await db.oAuthAuthorization.create({
    data: {
      clientId: client.clientId,
      redirectUri,
      state,
      scope: parseScopes(sp.get("scope")).join(" "),
      resource: mcpResource(),
      codeChallenge: challenge,
      expiresAt: new Date(Date.now() + LIFETIME.PENDING_MS),
    },
  })

  // Opportunistic cleanup of long-dead requests: cheap, and keeps the table
  // from growing without a cron.
  if (Math.random() < 0.05) {
    void db.oAuthAuthorization
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => {})
  }

  return { type: "consent", requestId: row.id }
}

// ---------------------------------------------------------------------------
// 2. Consent
// ---------------------------------------------------------------------------

export interface ConsentRequest {
  id: string
  clientName: string
  clientId: string
  clientKind: "cimd" | "dcr"
  clientUri: string | null
  redirectHost: string
  /** "Claude" / "ChatGPT" when the code goes to their official callback. */
  verifiedAs: string | null
  /** Only a program on this computer can receive the code. */
  loopback: boolean
  scopes: string[]
}

/** A pending request still waiting for a decision, or null. */
export async function getConsentRequest(id: string): Promise<ConsentRequest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const row = await db.oAuthAuthorization.findUnique({ where: { id } })
  if (!row || row.consumedAt || row.codeHash || row.expiresAt < new Date()) return null
  const client = await db.oAuthClient.findUnique({ where: { clientId: row.clientId } })
  if (!client) return null
  return {
    id: row.id,
    clientName: client.name,
    clientId: client.clientId,
    clientKind: client.kind === "dcr" ? "dcr" : "cimd",
    clientUri: client.clientUri,
    redirectHost: redirectHost(row.redirectUri),
    verifiedAs: verifiedClientName(row.redirectUri),
    loopback: isLoopbackRedirect(row.redirectUri),
    scopes: row.scope.split(" ").filter(Boolean),
  }
}

/** Everything the consent page renders, or null when the request is gone. */
export async function getConsentScreen(
  id: string,
  session: Session,
): Promise<{ request: ConsentRequest; workspace: string } | null> {
  const request = await getConsentRequest(id)
  if (!request) return null
  const tenant = await db.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { name: true },
  })
  return { request, workspace: tenant?.name ?? session.user.tenantSlug }
}

/**
 * The person clicked Allow. `session` is their normal cookie session (the
 * consent page is login-protected). Returns where to send the browser.
 */
export async function approveAuthorization(id: string, session: Session): Promise<string> {
  if (session.user.kind !== "employee") {
    throw new OAuthFlowError("access_denied", "AI apps can only be connected by staff accounts")
  }
  if (session.user.mustChangePassword) {
    throw new OAuthFlowError("access_denied", "Change your DNMS password first, then try again")
  }

  const row = await db.oAuthAuthorization.findUnique({ where: { id } })
  if (!row || row.consumedAt || row.codeHash || row.expiresAt < new Date()) {
    throw new OAuthFlowError(
      "invalid_request",
      "This sign-in request has expired. Start again from the AI app.",
    )
  }

  // Confirm the membership is live right now, not just when the cookie was minted.
  const membership = await loadMembershipIfStillValid(session.user.membershipId)
  if (!membership || membership.kind !== "STAFF" || membership.profileId !== session.user.id) {
    throw new OAuthFlowError("access_denied", "Your DNMS account is not active in this workspace")
  }

  const client = await db.oAuthClient.findUnique({ where: { clientId: row.clientId } })

  // The grant is created inside the person's own company - getSession() on the
  // consent action already entered it, and tenantId is set explicitly too.
  const grant = await db.oAuthGrant.create({
    data: {
      tenantId: membership.tenantId,
      membershipId: membership.id,
      userId: session.user.userId,
      employeeId: session.user.id,
      clientId: row.clientId,
      scope: row.scope,
      resource: row.resource,
    },
  })

  const code = generateToken(TOKEN_PREFIX.CODE)
  await db.oAuthAuthorization.update({
    where: { id: row.id },
    data: {
      codeHash: sha256Hex(code),
      grantId: grant.id,
      expiresAt: new Date(Date.now() + LIFETIME.CODE_MS),
    },
  })

  // Skipped automatically for the hidden admin_ account.
  await createAuditLog(session, {
    action: "ai_connector:connect",
    module: "ai_connector",
    entityType: "OAuthGrant",
    entityId: grant.id,
    changes: { app: client?.name ?? row.clientId, scope: row.scope },
  }).catch(() => {})

  return withParams(row.redirectUri, { code, state: row.state, iss: issuer() })
}

/** The person clicked Deny (or the request was bad). Returns where to send the browser. */
export async function denyAuthorization(id: string): Promise<string | null> {
  const row = await db.oAuthAuthorization.findUnique({ where: { id } })
  if (!row || row.consumedAt || row.codeHash) return null
  await db.oAuthAuthorization.update({ where: { id }, data: { consumedAt: new Date() } })
  return withParams(row.redirectUri, {
    error: "access_denied",
    error_description: "The person declined to connect DNMS",
    state: row.state,
    iss: issuer(),
  })
}

// ---------------------------------------------------------------------------
// 3. Token endpoint
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  refresh_token: string
  scope: string
}

async function issueTokens(grantId: string, scope: string): Promise<TokenResponse> {
  const access = generateToken(TOKEN_PREFIX.ACCESS)
  const refresh = generateToken(TOKEN_PREFIX.REFRESH)
  const now = Date.now()
  // Two plain creates rather than createMany (see the Prisma 7 + pg adapter
  // note on createMany in prisma/seed.ts).
  await db.$transaction([
    db.oAuthToken.create({
      data: {
        grantId,
        kind: "access",
        tokenHash: sha256Hex(access),
        expiresAt: new Date(now + LIFETIME.ACCESS_MS),
      },
    }),
    db.oAuthToken.create({
      data: {
        grantId,
        kind: "refresh",
        tokenHash: sha256Hex(refresh),
        expiresAt: new Date(now + LIFETIME.REFRESH_MS),
      },
    }),
  ])
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: Math.floor(LIFETIME.ACCESS_MS / 1000),
    refresh_token: refresh,
    scope,
  }
}

async function revokeGrant(grantId: string, reason: string): Promise<void> {
  await runUnscoped("ai connector: revoking a grant found by token", () =>
    db.oAuthGrant.updateMany({
      where: { id: grantId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
  )
}

export async function exchangeCode(form: URLSearchParams): Promise<TokenResponse> {
  const code = form.get("code") ?? ""
  const verifier = form.get("code_verifier") ?? ""
  if (!code || !verifier) {
    throw new OAuthFlowError("invalid_request", "code and code_verifier are required")
  }

  const row = await db.oAuthAuthorization.findUnique({ where: { codeHash: sha256Hex(code) } })
  if (!row || !row.grantId) throw new OAuthFlowError("invalid_grant", "Unknown authorization code")

  // Single use, enforced atomically: only one request can flip consumedAt.
  const claimed = await db.oAuthAuthorization.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })
  if (claimed.count !== 1) {
    // A code presented twice may have been stolen - kill what it produced.
    await revokeGrant(row.grantId, "authorization_code_replayed")
    throw new OAuthFlowError("invalid_grant", "Authorization code already used")
  }
  if (row.expiresAt < new Date())
    throw new OAuthFlowError("invalid_grant", "Authorization code expired")

  const clientId = form.get("client_id")
  if (clientId && clientId !== row.clientId) {
    throw new OAuthFlowError("invalid_grant", "Code was issued to a different client")
  }
  const redirectUri = form.get("redirect_uri")
  if (redirectUri && redirectUri !== row.redirectUri) {
    throw new OAuthFlowError(
      "invalid_grant",
      "redirect_uri does not match the authorization request",
    )
  }
  const resource = form.get("resource")
  if (resource && !sameResource(resource, row.resource)) {
    throw new OAuthFlowError("invalid_target", "resource does not match the authorization request")
  }
  if (!pkceMatches(verifier, row.codeChallenge)) {
    throw new OAuthFlowError("invalid_grant", "PKCE verification failed")
  }

  const grant = await runUnscoped("ai connector: the code decides the company", () =>
    db.oAuthGrant.findUnique({ where: { id: row.grantId! } }),
  )
  if (!grant || grant.revokedAt) throw new OAuthFlowError("invalid_grant", "Connection was revoked")

  return issueTokens(grant.id, grant.scope)
}

/** Grace window in which a just-used refresh token is refused without revoking. */
const REFRESH_RACE_MS = 60 * 1000

export async function refreshTokens(form: URLSearchParams): Promise<TokenResponse> {
  const presented = form.get("refresh_token") ?? ""
  if (!presented) throw new OAuthFlowError("invalid_request", "refresh_token is required")

  const token = await db.oAuthToken.findUnique({ where: { tokenHash: sha256Hex(presented) } })
  if (!token || token.kind !== "refresh") {
    throw new OAuthFlowError("invalid_grant", "Unknown refresh token")
  }

  if (token.usedAt) {
    // Rotation means a refresh token works once. Seeing it again is a theft
    // signal (OAuth 2.1 §4.3.1) - unless it is the same client racing itself
    // within a few seconds (proactive + reactive refresh), which is common.
    if (Date.now() - token.usedAt.getTime() > REFRESH_RACE_MS) {
      await revokeGrant(token.grantId, "refresh_token_reused")
    }
    throw new OAuthFlowError("invalid_grant", "Refresh token already used")
  }
  if (token.revokedAt || token.expiresAt < new Date()) {
    throw new OAuthFlowError("invalid_grant", "Refresh token expired or revoked")
  }

  const grant = await runUnscoped("ai connector: the refresh token decides the company", () =>
    db.oAuthGrant.findUnique({ where: { id: token.grantId } }),
  )
  if (!grant || grant.revokedAt) throw new OAuthFlowError("invalid_grant", "Connection was revoked")

  const clientId = form.get("client_id")
  if (clientId && clientId !== grant.clientId) {
    throw new OAuthFlowError("invalid_grant", "Refresh token was issued to a different client")
  }
  const resource = form.get("resource")
  if (resource && !sameResource(resource, grant.resource)) {
    throw new OAuthFlowError("invalid_target", "resource does not match this connection")
  }

  // Still entitled? Offboarded, deactivated or company suspended → done.
  const membership = await loadMembershipIfStillValid(grant.membershipId)
  if (!membership || membership.kind !== "STAFF") {
    await revokeGrant(grant.id, "membership_inactive")
    throw new OAuthFlowError("invalid_grant", "The DNMS account is no longer active")
  }
  if (membership.passwordChangedAt && membership.passwordChangedAt > grant.createdAt) {
    await revokeGrant(grant.id, "password_changed")
    throw new OAuthFlowError("invalid_grant", "The DNMS password changed - reconnect the app")
  }

  const claimed = await db.oAuthToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) throw new OAuthFlowError("invalid_grant", "Refresh token already used")

  return issueTokens(grant.id, grant.scope)
}

/** RFC 7009. Revoking either token disconnects the whole connection. Always succeeds. */
export async function revokeToken(form: URLSearchParams): Promise<void> {
  const presented = form.get("token") ?? ""
  if (!presented) return
  const token = await db.oAuthToken.findUnique({ where: { tokenHash: sha256Hex(presented) } })
  if (!token) return
  await revokeGrant(token.grantId, "revoked_by_app")
}
