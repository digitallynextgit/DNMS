import { toast } from "sonner"

import { formatHours } from "./format-hours"

// =============================================================================
// What happens AFTER a task PATCH lands, in one place.
//
// A task is moved from four different screens (My Tasks, the sheet, the kanban,
// the detail panel) and every one of them has to answer the same two questions
// the server's reply raises: was the stretch shared with other running clocks,
// and should anything be said out loud. Three copies of that meant the sheet
// view quietly dropped one - the bug this module exists to make impossible.
//
// Client-safe on purpose: no `server-only`, no Prisma. Its whole job is reading
// a response body a caller already has.
// =============================================================================

/** The shape of `PATCH /api/tasks/[id]`'s reply, as much of it as callers read. */
export interface TaskPatchResponse {
  data?: {
    id: string
    projectId: string | null
    title: string
    links?: string[]
    assigneeId: string | null
    startDate: string | null
  }
  sharedTasks?: { title: string; creditedHours: number; sharedWith: number }[]
}

/**
 * Say what the reply says.
 *
 * `silent` suppresses only the "it saved" toast - a shared stretch is never
 * silent, because time landing at half rate is not something the person can
 * see for themselves.
 */
export function afterTaskPatch(
  result: unknown,
  opts: { silent?: boolean; successMessage?: string } = {},
): void {
  const r = (result ?? null) as TaskPatchResponse | null

  // Several tasks may run at once, and while they do they SHARE the clock - so
  // the stretch just ended was split between them. Said once, plainly, because
  // time landing at half rate is otherwise only noticeable in a report next
  // month.
  const shared = r?.sharedTasks
  if (shared?.length) {
    const n = shared[0]!.sharedWith
    toast.info(`Time split across ${n} tasks`, {
      description: shared.map((s) => `${s.title}: +${formatHours(s.creditedHours)}`).join(" · "),
    })
  }

  if (!opts.silent) toast.success(opts.successMessage ?? "Updated")
}
