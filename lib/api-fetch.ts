import type { ActionResult } from "@/server/action-result"

/**
 * Centralized client-side fetch for API route handlers.
 *
 * On a non-2xx response it throws an `Error` carrying the server's message
 * (so React Query's `onError` / toast handling keeps working). On success it
 * returns the parsed JSON body UNCHANGED — callers read `.data` / `.pagination`
 * / `.meta` themselves, exactly as they did with `await res.json()`. An empty
 * body resolves to `null`.
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()
  const body = text ? safeJsonParse(text) : null

  if (!res.ok) {
    const message =
      body?.error?.message ?? body?.error ?? body?.message ?? `Request failed (${res.status})`
    throw new Error(typeof message === "string" ? message : `Request failed (${res.status})`)
  }
  return body as T
}

/**
 * Re-throw a server action's returned error so client React Query hooks get a
 * thrown Error (their existing `onError`/toast path), otherwise return `data`.
 * Replaces the repeated `if (!r.ok) throw new Error(r.error); return r.data`.
 */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
