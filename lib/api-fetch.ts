import type { ActionResult } from "@/server/action-result"

/**
 * Client fetch for API routes. Non-2xx throws an Error with the server's message; otherwise returns
 * the parsed body as-is (callers read `.data` themselves), or null when empty.
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()
  const body = text ? safeJsonParse(text) : null

  if (!res.ok) {
    const message =
      body?.error?.message ?? body?.error ?? body?.message ?? `Request failed (${res.status})`
    const error = new Error(
      typeof message === "string" ? message : `Request failed (${res.status})`,
    ) as ApiError
    // Machine-readable status/code, so callers can act on a specific rejection without string-matching.
    error.status = res.status
    // Also accept bare `{ error, code }` bodies.
    error.code = body?.error?.code ?? body?.code
    error.details = body?.error?.details ?? body?.details
    throw error
  }
  return body as T
}

export interface ApiError extends Error {
  status?: number
  code?: string
  details?: unknown
}

/** Throws a server action's error (for React Query's onError), otherwise returns `data`. */
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
