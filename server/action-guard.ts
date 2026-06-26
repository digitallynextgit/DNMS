// =============================================================================
// Server-action auth/permission guards
// =============================================================================
// Server-side only (imported by the *.service.ts modules). Mirrors the route
// wrappers withSession / withAuth from lib/permissions.ts, but throws an
// ActionError (caught by runAction) instead of returning a NextResponse; the
// thin route handlers turn that ActionResult into an HTTP response via respond().
// =============================================================================

import { headers } from "next/headers"
import { getSession } from "@/server/api-handler"
import { isSuperAdmin } from "@/lib/permissions"
import { ActionError } from "./action-result"
import type { Session } from "next-auth"

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new ActionError("Unauthorized", 401)
  return session
}

export async function requirePermission(perm: string | string[]): Promise<Session> {
  const session = await requireSession()
  const perms = Array.isArray(perm) ? perm : [perm]
  const allowed = isSuperAdmin(session) || perms.every((p) => session.user.permissions.includes(p))
  if (!allowed) throw new ActionError("Forbidden: insufficient permissions", 403)
  return session
}

// IP / User-Agent for audit logs (routes read these off the request).
export async function getAuditMeta(): Promise<{ ipAddress?: string; userAgent?: string }> {
  const h = await headers()
  return {
    ipAddress: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
    userAgent: h.get("user-agent") ?? undefined,
  }
}
