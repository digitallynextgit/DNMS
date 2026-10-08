// Pure session predicates, safe on client and server (no server-only imports).

import { SYSTEM_ROLES } from "./constants"
import type { Session } from "next-auth"

export function isAdmin_(session: Session): boolean {
  return session.user.roles.includes(SYSTEM_ROLES.ADMIN_)
}

export function hasPermission(session: Session, scope: string): boolean {
  if (isAdmin_(session)) return true
  return session.user.permissions.includes(scope)
}

export function hasAnyPermission(session: Session, scopes: string[]): boolean {
  if (isAdmin_(session)) return true
  return scopes.some((scope) => session.user.permissions.includes(scope))
}

export function hasAllPermissions(session: Session, scopes: string[]): boolean {
  if (isAdmin_(session)) return true
  return scopes.every((scope) => session.user.permissions.includes(scope))
}

export function canAccessEmployee(session: Session, employeeId: string): boolean {
  if (isAdmin_(session)) return true
  if (hasPermission(session, "employee:read")) return true
  return session.user.id === employeeId
}
