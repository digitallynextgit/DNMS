import { toast } from "sonner"

import { useOutputCaptureStore } from "@/stores/output-capture-store"
import { formatHours } from "./format-hours"

// =============================================================================
// What happens AFTER a task PATCH lands, in one place.
//
// A task is moved from four different screens (My Tasks, the sheet, the kanban,
// the detail panel) and every one of them has to answer the same three
// questions the server's reply raises: was the stretch shared with other running
// clocks, should anything be said out loud, and did finishing this leave an
// expected output unrecorded. Three copies of that meant the sheet view quietly
// dropped the capture prompt - the bug this module exists to make impossible.
//
// Client-safe on purpose: no `server-only`, no Prisma. Its whole job is reading
// a response body a caller already has.
// =============================================================================

/** A row already promised for this task - "we owed them a reel, is this it?" */
export interface PlannedDeliverable {
  id: string
  type: string
  title: string
  quantity: number
  links: string[]
  notes: string | null
  /** Null while the row is owed by a team and nobody has claimed it. */
  employeeId: string | null
  /** yyyy-MM-dd. */
  startedOn: string | null
  /** yyyy-MM-dd. */
  dueOn: string | null
  status: "PLANNED" | "IN_PROGRESS"
}

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
  needsOutput?: boolean
  plannedDeliverable?: PlannedDeliverable | null
  sharedTasks?: { title: string; creditedHours: number; sharedWith: number }[]
}

/**
 * Say what the reply says, then ask what it asks.
 *
 * `silent` suppresses only the "it saved" toast - a shared stretch and a missing
 * output are never silent, because both are things the person cannot see for
 * themselves.
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

  // Finished a task that was expected to produce something, with nothing logged
  // against it? Ask now, prefilled - this is the moment the answer is still in
  // the person's head. When something was already PLANNED against the task the
  // prompt confirms THAT row rather than opening a blank one, which is what
  // stops a promise and its delivery becoming two rows. See
  // stores/output-capture-store.ts.
  const planned = r?.plannedDeliverable ?? null
  if (r?.data?.projectId && (planned || r.needsOutput)) {
    useOutputCaptureStore.getState().ask({
      taskId: r.data.id,
      projectId: r.data.projectId,
      title: r.data.title,
      links: r.data.links ?? [],
      employeeId: r.data.assigneeId,
      startedOn: r.data.startDate ? r.data.startDate.slice(0, 10) : null,
      planned,
    })
  }
}
