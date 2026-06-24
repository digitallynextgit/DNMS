// =============================================================================
// Standard API response shape (CLAUDE.md §3)
// =============================================================================
// Used by API route handlers (app/api/**/route.ts). NOTE: this is distinct from
// the server-action result helpers in server/action-result.ts (which also export
// `ok`/`fail` but with the `ActionResult` wire shape). Import the one that
// matches the layer you're in.
// =============================================================================

import { NextResponse } from "next/server"

type Success<T> = { success: true; data: T }
type Failure = {
  success: false
  error: { code: string; message: string; details?: unknown }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<Success<T>>({ success: true, data }, init)
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<Failure>(
    { success: false, error: { code, message, details } },
    { status },
  )
}
