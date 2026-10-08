import { toast } from "sonner"

import type { ApiError } from "@/lib/api-fetch"

/** Turns anything thrown into the sentence the user reads (covers bare 500s, non-Errors, 401/403). */
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

/** With a `title`, the server's reason becomes the description line; without one, it's the toast. */
export function toastError(err: unknown, title?: string): void {
  const reason = errorMessage(err, title ?? "Something went wrong")
  if (title && reason !== title) toast.error(title, { description: reason })
  else toast.error(reason)
}
