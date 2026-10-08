// Service-layer guards: like withSession / withAuth, but throw ActionError (caught by runAction).

import { headers } from "next/headers"
import { getSession } from "@/server/api-handler"
import { isAdmin_ } from "@/lib/permissions"
import { ActionError } from "./action-result"
import type { Session } from "next-auth"

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new ActionError("Unauthorized", 401)
  // Staff-only: clients have no employees row. Portal services use requireClientSession.
  if (session.user.kind === "client") {
    throw new ActionError("Forbidden: not available to client accounts", 403)
  }
  return session
}

export async function requirePermission(perm: string | string[]): Promise<Session> {
  const session = await requireSession()
  const perms = Array.isArray(perm) ? perm : [perm]
  const allowed = isAdmin_(session) || perms.every((p) => session.user.permissions.includes(p))
  if (!allowed) throw new ActionError("Forbidden: insufficient permissions", 403)
  return session
}

// Any one of the roles (admin_ always passes) - for actions gated on who someone IS.
export async function requireAnyRole(roles: string[]): Promise<Session> {
  const session = await requireSession()
  const userRoles = session.user.roles ?? []
  const allowed = isAdmin_(session) || roles.some((r) => userRoles.includes(r))
  if (!allowed) throw new ActionError("Forbidden: insufficient role", 403)
  return session
}

export async function getAuditMeta(): Promise<{ ipAddress?: string; userAgent?: string }> {
  const h = await headers()
  return {
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  }
}
