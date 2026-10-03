import "server-only"

import type { Session } from "next-auth"
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

// =============================================================================
// Access token → the person behind it.
//
// Runs on EVERY MCP request, so a change in DNMS applies to the AI app on its
// very next call:
//   - disconnected in DNMS, or the app revoked it      → 401
//   - employee deactivated / offboarded / company suspended → 401
//   - password changed after connecting                → 401 (and grant revoked)
//   - roles or permissions changed                     → new ones apply at once
// =============================================================================

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
 * The resource-server token check, in the MCP SDK's verifier shape. Anything
 * not valid throws invalid_token, which the SDK's bearer gate turns into
 * 401 + WWW-Authenticate pointing at our Protected Resource Metadata.
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
  // Everything up to "which company" is unscoped by necessity - the token is
  // what decides it (same as sign-in).
  return runUnscoped("ai connector: the access token decides the company", async () => {
    const token = await db.oAuthToken.findUnique({
      where: { tokenHash: sha256Hex(bearer) },
      include: { grant: true },
    })
    const now = new Date()
    if (!token || token.kind !== "access" || token.revokedAt || token.expiresAt <= now) return null
    const grant = token.grant
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
      expires: token.expiresAt.toISOString(),
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
      expiresAt: Math.floor(token.expiresAt.getTime() / 1000),
      invisible: data.roles.includes(SYSTEM_ROLES.ADMIN_),
    } satisfies Principal
  })
}

/** The principal stashed on the verified request by verifyAccessToken. */
export function principalFrom(authInfo: AuthInfo | undefined): Principal {
  const p = authInfo?.extra?.principal as Principal | undefined
  if (!p) throw new Error("No verified principal on this MCP request")
  return p
}

/**
 * Run `fn` as the principal: inside their company (tenant guard) AND as them
 * (getSession → their session). Everything DNMS already enforces - withAuth,
 * requirePermission, per-record checks, audit logging - then applies unchanged.
 */
export function runAsPrincipal<T>(principal: Principal, fn: () => Promise<T>): Promise<T> {
  return runWithTenant({ tenantId: principal.tenantId, slug: principal.tenantSlug }, () =>
    runAsDelegate(principal.session, fn),
  )
}
