// =============================================================================
// Pure, client-safe session predicates.
// =============================================================================
// No server-only imports here (these run in both client and server contexts,
// e.g. the sidebar checks permissions). Route wrappers / getSession live in
// @/server/api-handler.
// =============================================================================

import { SYSTEM_ROLES } from "./constants"
import type { Session } from "next-auth"

export function isSuperAdmin(session: Session): boolean {
  return session.user.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)
}

export function hasPermission(session: Session, scope: string): boolean {
  if (isSuperAdmin(session)) return true
  return session.user.permissions.includes(scope)
}

export function hasAnyPermission(session: Session, scopes: string[]): boolean {
  if (isSuperAdmin(session)) return true
  return scopes.some((scope) => session.user.permissions.includes(scope))
}

export function hasAllPermissions(session: Session, scopes: string[]): boolean {
  if (isSuperAdmin(session)) return true
  return scopes.every((scope) => session.user.permissions.includes(scope))
}

export function canAccessEmployee(session: Session, employeeId: string): boolean {
  if (isSuperAdmin(session)) return true
  if (hasPermission(session, "employee:read")) return true
  return session.user.id === employeeId
}
