// Actions RETURN errors instead of throwing, because Next redacts thrown messages in production.

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

// Plain-JSON copy (Date -> ISO string), same as a fetch + res.json() payload. `any` on purpose,
// so callers keep their declared types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialize(value: unknown): any {
  return JSON.parse(JSON.stringify(value))
}

// Thrown by the guards; runAction turns it into an ActionFail.
export class ActionError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "ActionError"
    this.status = status
  }
}

export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ActionError) return fail(e.message, undefined, e.status)

    // Validation failures are the user's to fix, so say which field is wrong.
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
