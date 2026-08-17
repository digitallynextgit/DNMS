// =============================================================================
// Server-action result helpers
// =============================================================================
// Server actions RETURN errors instead of throwing them, because Next.js
// redacts thrown error messages in production. Client hooks re-throw the
// returned error so React Query's existing onError/toast handling keeps working.
// =============================================================================

import { ZodError } from "zod"

export type ActionOk<T> = { ok: true; data: T }
export type ActionFail = { ok: false; error: string; details?: unknown; status?: number }
export type ActionResult<T> = ActionOk<T> | ActionFail

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data }
}

export function fail(error: string, details?: unknown, status?: number): ActionFail {
  return { ok: false, error, details, status }
}

// Convert a DB result to its plain-JSON form (Date -> ISO string, etc.) so an
// action's payload matches the previous `fetch` + `res.json()` wire shape.
// Returns `any` on purpose: callers (the React Query hooks) keep their existing
// declared return types, exactly as they did with `res.json()`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(value: unknown): any {
  return JSON.parse(JSON.stringify(value))
}

// Thrown by the auth/permission guards; converted to an ActionFail by runAction.
export class ActionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "ActionError"
    this.status = status
  }
}

// Wraps an action body: guard failures (ActionError) and unexpected errors are
// turned into a safe ActionFail instead of a redacted thrown error.
export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ActionError) return fail(e.message, undefined, e.status)

    // Validation failures are the user's to fix, so say WHAT is wrong.
    //
    // Services call `schema.parse()` inside this wrapper, so a ZodError was
    // being flattened into "Internal server error" - a message that blames the
    // server for a field the person could have corrected in two seconds, and
    // sends whoever debugs it looking for an outage that isn't there.
    // withErrorHandler already does this for routes that throw; the action path
    // never got the same treatment.
    if (e instanceof ZodError) {
      const first = e.issues[0]
      const field = first?.path?.join(".")
      return fail(
        first ? `${field ? `${field}: ` : ""}${first.message}` : "Invalid input",
        e.flatten(),
        422,
      )
    }

    console.error("[action] unexpected error:", e)
    return fail("Internal server error", undefined, 500)
  }
}
