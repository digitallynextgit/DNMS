import type { ApiError } from "@/lib/api-fetch"

/** Raised when a hold follow-up is moved after its original task was picked up again. */
export interface FollowUpConflictDetails {
  reason: "FOLLOW_UP_REDUNDANT"
  taskId: string
  taskTitle: string
  originalTitle: string
  originalStatus: string
}

/** The follow-up conflict in a failed request, or null so other errors fall through to a toast. */
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
