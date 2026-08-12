import type { ApiError } from "@/lib/api-fetch"

/**
 * The question the server asks when someone moves a hold follow-up whose
 * original task has already been picked up again. Shared by the code that
 * RAISES it (the task PATCH route) and the dialog that answers it, so the two
 * cannot drift apart on the shape of the payload.
 */
export interface FollowUpConflictDetails {
  reason: "FOLLOW_UP_REDUNDANT"
  taskId: string
  taskTitle: string
  originalTitle: string
  originalStatus: string
}

/**
 * Read a follow-up conflict out of a failed request, or null if the failure was
 * something else entirely. Every status-change call site runs its error through
 * this, so a rejection nobody recognises still falls through to a normal toast.
 */
export function followUpConflictFrom(error: unknown): FollowUpConflictDetails | null {
  const details = (error as ApiError | undefined)?.details as
    | Partial<FollowUpConflictDetails>
    | undefined
  if (!details || details.reason !== "FOLLOW_UP_REDUNDANT") return null
  if (!details.taskId || !details.originalTitle) return null
  return {
    reason: "FOLLOW_UP_REDUNDANT",
    taskId: details.taskId,
    taskTitle: details.taskTitle ?? "This task",
    originalTitle: details.originalTitle,
    originalStatus: details.originalStatus ?? "DONE",
  }
}
