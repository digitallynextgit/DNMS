import { toast } from "sonner"

import type { ApiError } from "@/lib/api-fetch"

/**
 * One place that turns "whatever was thrown" into the sentence the user reads.
 *
 * `apiFetch` already throws an Error carrying the server's message, so most of
 * the time this is just `err.message`. The cases it papers over: a bare
 * `Request failed (500)` (server crashed without a message), a non-Error throw,
 * and an expired session / missing permission where the status says more than
 * the prose.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof Error) {
    const message = err.message?.trim()
    const status = (err as ApiError).status
    if (message && !/^Request failed \(\d+\)$/.test(message)) return message
    if (status === 401) return "Your session has expired - sign in again"
    if (status === 403) return "You don't have permission to do that"
    if (status === 404) return "That no longer exists - refresh and try again"
    if (status && status >= 500) return "Something went wrong on the server - try again"
    return fallback
  }
  if (typeof err === "string" && err.trim()) return err
  return fallback
}

/**
 * Toast a failure. With a `title` ("Couldn't save the task") the server's
 * reason becomes the description line, so the user gets both the action that
 * failed and why; without one, the reason is the toast itself.
 */
export function toastError(err: unknown, title?: string): void {
  const reason = errorMessage(err, title ?? "Something went wrong")
  if (title && reason !== title) toast.error(title, { description: reason })
  else toast.error(reason)
}
