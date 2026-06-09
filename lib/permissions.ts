import { auth } from "./auth-options"
import { NextRequest, NextResponse } from "next/server"
import { SYSTEM_ROLES } from "./constants"
import type { Session } from "next-auth"

export async function getSession(): Promise<Session | null> {
  return auth() as Promise<Session | null>
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteHandler = (
  req: NextRequest,
  context: { params: any },
  session: Session,
) => Promise<NextResponse> | NextResponse

// Next 16 passes `params` as a Promise. Resolve it once in the wrapper so
// every handler can keep destructuring `ctx.params` synchronously.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextRouteContext = { params: Promise<any> | any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveParams(context: NextRouteContext): Promise<any> {
  const raw = context?.params
  return raw && typeof (raw as Promise<unknown>).then === "function" ? await raw : (raw ?? {})
}

export function withAuth(requiredPermission: string | string[], handler: RouteHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const permissions = Array.isArray(requiredPermission)
      ? requiredPermission
      : [requiredPermission]

    const hasAccess =
      isSuperAdmin(session) || permissions.every((p) => session.user.permissions.includes(p))

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const params = await resolveParams(context)
    return handler(req, { params }, session)
  }
}

// Variant for routes that just need an authenticated user (no specific permission)
export function withSession(handler: RouteHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const params = await resolveParams(context)
    return handler(req, { params }, session)
  }
}
