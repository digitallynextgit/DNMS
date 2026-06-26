// =============================================================================
// API route infrastructure (CLAUDE.md §3/§4)
// =============================================================================
// - withErrorHandler: wraps a plain route handler; maps ZodError / AppError /
//   unknown errors to the standard `fail()` response.
// - withAuth / withSession: authenticate (and authorize) first, then run the
//   handler inside the same error funnel. Handlers may `throw` AppError
//   subclasses (or return `ok()/fail()`); per-handler try/catch is no longer
//   needed.
// Pure, client-safe session predicates live in @/lib/permissions.
// =============================================================================

import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { ZodError } from "zod"
import type { Session } from "next-auth"
import { auth } from "@/server/auth"
import { isSuperAdmin } from "@/lib/permissions"
import { AppError, UnauthorizedError, ForbiddenError } from "@/lib/errors"
import { fail, ok } from "@/lib/api-response"
import type { ActionResult } from "@/server/action-result"

export async function getSession(): Promise<Session | null> {
  return auth() as Promise<Session | null>
}

// Next 16 passes `params` as a Promise; resolve it once so handlers keep
// destructuring `ctx.params` synchronously.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextRouteContext = { params: Promise<any> | any }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveParams(context: NextRouteContext): Promise<any> {
  const raw = context?.params
  return raw && typeof (raw as Promise<unknown>).then === "function" ? await raw : (raw ?? {})
}

function handleError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Invalid input", 422, err.flatten())
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
 * Map a server-only service ActionResult ({ ok, data } | { ok:false, error, … })
 * to the standard HTTP envelope, so thin route handlers can wrap service
 * functions directly:
 *   export const GET = withSession(async () => respond(await listThings()))
 * Success → ok(data); failure → fail() with the carried status (default 400).
 */
export function respond<T>(result: ActionResult<T>, okStatus = 200): NextResponse {
  if (result.ok) return ok(result.data, { status: okStatus })
  const status = result.status ?? 400
  return fail(STATUS_CODE[status] ?? "ERROR", result.error, status, result.details)
}

// Standardize a handler's JSON response to the CLAUDE.md envelope:
//   success → { success: true, data }   ({ data } is lifted; { data, pagination }
//             becomes { items, pagination }; any other body is wrapped intact)
//   error   → { success: false, error: { code, message, details } }
// Non-JSON responses (file downloads, redirects) and already-standard bodies are
// passed through untouched, so this is idempotent with ok()/fail().
async function normalize(res: Response): Promise<Response> {
  const contentType = res.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return res

  const status = res.status
  let body: unknown
  try {
    body = await res.clone().json()
  } catch {
    return res
  }
  if (body && typeof body === "object" && "success" in body) return res // already standard

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

  // Success: add the success flag while PRESERVING the handler's payload keys, so
  // existing consumers (which read `result.data`, and a few that read other keys)
  // keep working. A bare `{ data }` body becomes the strict { success, data }
  // envelope; arrays / primitives are wrapped under `data`.
  if (Array.isArray(body) || body === null || typeof body !== "object") {
    return NextResponse.json({ success: true, data: body }, { status })
  }
  return NextResponse.json({ success: true, ...(body as Record<string, unknown>) }, { status })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthedHandler = (
  req: NextRequest,
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

/** Require an authenticated session AND the given permission(s). */
export function withAuth(requiredPermission: string | string[], handler: AuthedHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) throw new UnauthorizedError()

      const permissions = Array.isArray(requiredPermission)
        ? requiredPermission
        : [requiredPermission]
      const allowed =
        isSuperAdmin(session) || permissions.every((p) => session.user.permissions.includes(p))
      if (!allowed) throw new ForbiddenError("Forbidden: insufficient permissions")

      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }, session))
    } catch (err) {
      return handleError(err)
    }
  }
}

/** Require an authenticated session (no specific permission). */
export function withSession(handler: AuthedHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) throw new UnauthorizedError()
      const params = await resolveParams(context)
      return await normalize(await handler(req, { params }, session))
    } catch (err) {
      return handleError(err)
    }
  }
}
