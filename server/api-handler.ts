import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { Session } from "next-auth"
import { auth } from "@/server/auth"
import { enterTenant } from "@/server/tenant-context"
import { delegatedSession } from "@/server/delegated-session"
import { isAdmin_ } from "@/lib/permissions"
import { AppError, UnauthorizedError, ForbiddenError } from "@/lib/errors"
import { fail, ok } from "@/lib/api-response"
import type { ActionResult } from "@/server/action-result"

/**
 * The session, AND where the tenant context is entered for every API route and server action.
 * Server components use tenantScopedSession() (server/tenant-request.ts) instead.
 */
export async function getSession(): Promise<Session | null> {
  // An AI app acting for a verified person (MCP); its tenant is already entered.
  const delegated = delegatedSession()
  if (delegated) return delegated

  const session = (await auth()) as Session | null
  if (session?.user?.tenantId && session.user.tenantSlug) {
    enterTenant({ tenantId: session.user.tenantId, slug: session.user.tenantSlug })
  }
  return session
}

/** Also covers withSession, which would otherwise let a client reach every "signed-in" API. */
function assertStaff(session: Session): void {
  if (session.user.kind === "client") {
    throw new ForbiddenError("This endpoint is not available to client accounts")
  }
}

// Next 16 passes `params` as a Promise; resolved once so handlers read ctx.params directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextRouteContext = { params: Promise<any> | any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveParams(context: NextRouteContext): Promise<any> {
  const raw = context?.params
  return raw && typeof (raw as Promise<unknown>).then === "function" ? await raw : (raw ?? {})
}

/** The first zod issue as a toast-ready sentence: "Title is required", "Email: Invalid email". */
function zodMessage(err: ZodError): string {
  const issue = err.issues[0]
  if (!issue) return "Invalid input"
  const leaf = issue.path.filter((p): p is string => typeof p === "string").pop()
  if (!leaf) return issue.message
  const field = leaf
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase())
  if (/^required$/i.test(issue.message) || /expected \w+, received undefined/i.test(issue.message))
    return `${field} is required`
  return `${field}: ${issue.message}`
}

function handleError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return fail("VALIDATION_ERROR", zodMessage(err), 422, err.flatten())
  }
  if (err instanceof AppError) {
    return fail(err.code, err.message, err.statusCode, err.details)
  }
  console.error("[UNHANDLED]", err)
  return fail("INTERNAL_ERROR", "Something went wrong", 500)
}

const STATUS_CODE: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
  500: "INTERNAL_ERROR",
}

/**
 * Map a service ActionResult to the standard envelope (failure status defaults to 400):
 *   export const GET = withSession(async () => respond(await listThings()))
 */
export function respond<T>(result: ActionResult<T>, okStatus = 200): NextResponse {
  if (result.ok) return ok(result.data, { status: okStatus })
  const status = result.status ?? 400
  return fail(STATUS_CODE[status] ?? "ERROR", result.error, status, result.details)
}

// Coerce a handler's JSON into the standard { success, ... } envelope. Non-JSON responses and
// already-standard bodies pass through untouched.
async function normalize(res: Response): Promise<Response> {
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return res

  const status = res.status

  // Read once as text (no clone), so pass-throughs can return the original string.
  const text = await res.text()
  const passThrough = () =>
    new NextResponse(text, { status, headers: res.headers, statusText: res.statusText })

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return passThrough()
  }
  if (body && typeof body === "object" && "success" in body) return passThrough() // already standard

  if (status >= 400) {
    const b = (body ?? {}) as Record<string, unknown>
    const message =
      typeof b.error === "string"
        ? b.error
        : typeof b.message === "string"
          ? b.message
          : "Request failed"
    return fail(STATUS_CODE[status] ?? "ERROR", message, status, b.details)
  }

  // Keep the handler's own keys (some consumers read more than `data`); wrap arrays/primitives.
  if (Array.isArray(body) || body === null || typeof body !== "object") {
    return NextResponse.json({ success: true, data: body }, { status })
  }
  return NextResponse.json({ success: true, ...(body as Record<string, unknown>) }, { status })
}

type AuthedHandler = (
  req: NextRequest,
  // `params` varies per route, so it is genuinely untyped here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: { params: any },
  session: Session,
) => Promise<Response> | Response

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlainHandler = (req: NextRequest, context: { params: any }) => Promise<Response> | Response

/** For routes that self-authenticate (public/cron) but want the standard error funnel. */
export function withErrorHandler(handler: PlainHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }))
    } catch (err) {
      return handleError(err)
    }
  }
}

export function withAuth(requiredPermission: string | string[], handler: AuthedHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) throw new UnauthorizedError()
      assertStaff(session)

      const permissions = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission]
      const allowed =
        isAdmin_(session) || permissions.every((p) => session.user.permissions.includes(p))
      if (!allowed) throw new ForbiddenError("Forbidden: insufficient permissions")

      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }, session))
    } catch (err) {
      return handleError(err)
    }
  }
}

export function withSession(handler: AuthedHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) throw new UnauthorizedError()
      assertStaff(session)
      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }, session))
    } catch (err) {
      return handleError(err)
    }
  }
}

/** Signed-in CLIENT only: staff are rejected so they can't skip the per-project access check. */
export function withClientSession(handler: AuthedHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) throw new UnauthorizedError()
      if (session.user.kind !== "client") {
        throw new ForbiddenError("This endpoint is for client portal accounts")
      }
      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }, session))
    } catch (err) {
      return handleError(err)
    }
  }
}
