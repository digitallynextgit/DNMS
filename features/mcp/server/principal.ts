import "server-only"

import type { Session } from "next-auth"
import type { OAuthGrant } from "@prisma/client"
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server"
import { db } from "@/server/db"
import { runUnscoped, runWithTenant } from "@/server/tenant-context"
import { runAsDelegate } from "@/server/delegated-session"
import { loadMembershipIfStillValid } from "@/server/identity"
import { getUserWithPermissions } from "@/server/auth"
import { SYSTEM_ROLES } from "@/lib/constants"
import { TOKEN_PREFIX } from "../constants"
import { mcpResource, resourceMetadataUrl } from "./config"
import { sha256Hex } from "./tokens"

// Access token -> the person behind it. Runs on every MCP request, so disconnects, deactivation,
// password changes (grant revoked) and permission changes apply on the next call.

export interface Principal {
  session: Session
  grantId: string
  clientId: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  scopes: string[]
  /** Access-token expiry, seconds since epoch. */
  expiresAt: number
  /** The hidden admin_ account - never logged anywhere. */
  invisible: boolean
}

/** Only touch lastUsedAt this often, so every call is not a write. */
const LAST_USED_EVERY_MS = 5 * 60 * 1000

/**
 * Resource-server token check (MCP SDK verifier shape). Invalid tokens throw invalid_token -> 401.
 */
export const tokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(bearer: string): Promise<AuthInfo> {
    const principal = bearer.startsWith(TOKEN_PREFIX.ACCESS) ? await resolvePrincipal(bearer) : null
    if (!principal) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or expired DNMS access token")
    }
    return {
      token: bearer,
      clientId: principal.clientId,
      scopes: principal.scopes,
      expiresAt: principal.expiresAt,
      resource: new URL(mcpResource()),
      resourceMetadataUrl: resourceMetadataUrl(),
      extra: { principal },
    }
  },
}

export async function resolvePrincipal(bearer: string): Promise<Principal | null> {
  // Unscoped until the token decides the company (same as sign-in).
  return runUnscoped("ai connector: the access token decides the company", async () => {
    const token = await db.oAuthToken.findUnique({
      where: { tokenHash: sha256Hex(bearer) },
      include: { grant: true },
    })
    if (!token || token.kind !== "access" || token.revokedAt || token.expiresAt <= new Date()) {
      return null
    }
    return principalForGrant(token.grant, token.expiresAt)
  })
}

/**
 * The same person, from a connection id - for download links opened in a browser with no bearer
 * token. Every token check still applies.
 */
export async function resolvePrincipalByGrant(grantId: string): Promise<Principal | null> {
  return runUnscoped("ai connector: a download link names its connection", async () => {
    const grant = await db.oAuthGrant.findUnique({ where: { id: grantId } })
    if (!grant) return null
    return principalForGrant(grant, new Date(Date.now() + 10 * 60_000))
  })
}

/** Shared by both paths above. Must run inside runUnscoped (the grant decides the company). */
async function principalForGrant(
  grant: OAuthGrant,
  sessionExpires: Date,
): Promise<Principal | null> {
  const now = new Date()
  if (grant.revokedAt) return null
  // Audience binding (RFC 8707): a token minted for another resource is useless here.
  if (grant.resource.replace(/\/+$/, "") !== mcpResource()) return null

  const membership = await loadMembershipIfStillValid(grant.membershipId)
  if (!membership || membership.kind !== "STAFF" || membership.profileId !== grant.employeeId) {
    return null
  }
  if (membership.passwordChangedAt && membership.passwordChangedAt > grant.createdAt) {
    await db.oAuthGrant.update({
      where: { id: grant.id },
      data: { revokedAt: now, revokedReason: "password_changed" },
    })
    return null
  }

  const [user, data] = await Promise.all([
    db.user.findUnique({ where: { id: grant.userId }, select: { email: true, name: true } }),
    getUserWithPermissions(grant.employeeId),
  ])
  if (!user || !data) return null

  if (!grant.lastUsedAt || now.getTime() - grant.lastUsedAt.getTime() > LAST_USED_EVERY_MS) {
    void db.oAuthGrant
      .update({ where: { id: grant.id }, data: { lastUsedAt: now } })
      .catch(() => {})
  }

  const session: Session = {
    expires: sessionExpires.toISOString(),
    user: {
      id: data.employee.id,
      email: user.email,
      name: user.name ?? `${data.employee.firstName} ${data.employee.lastName}`.trim(),
      kind: "employee",
      userId: grant.userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenantSlug,
      employeeNo: data.employee.employeeNo,
      firstName: data.employee.firstName,
      lastName: data.employee.lastName,
      company: null,
      profilePhoto: data.employee.profilePhoto ?? null,
      roles: data.roles,
      permissions: data.permissions,
      mustChangePassword: membership.mustChangePassword,
    },
  }

  return {
    session,
    grantId: grant.id,
    clientId: grant.clientId,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    tenantName: membership.tenantName,
    scopes: grant.scope.split(" ").filter(Boolean),
    expiresAt: Math.floor(sessionExpires.getTime() / 1000),
    invisible: data.roles.includes(SYSTEM_ROLES.ADMIN_),
  } satisfies Principal
}

/** The principal stashed on the verified request by verifyAccessToken. */
export function principalFrom(authInfo: AuthInfo | undefined): Principal {
  const p = authInfo?.extra?.principal as Principal | undefined
  if (!p) throw new Error("No verified principal on this MCP request")
  return p
}

/** Run `fn` inside the principal's company and as them, so every existing DNMS check applies. */
export function runAsPrincipal<T>(principal: Principal, fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ tenantId: principal.tenantId, slug: principal.tenantSlug }, () =>
    runAsDelegate(principal.session, fn),
  )
}
