import { toast } from "sonner"

// =============================================================================
// What happens AFTER a task PATCH lands, in one place.
//
// A task is moved from four different screens (My Tasks, the sheet, the kanban,
// the detail panel) and every one of them has to say the same thing about the
// server's reply. Three copies of that meant the sheet view quietly dropped
// one - the bug this module exists to make impossible.
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
}

/** Say what the reply says. `silent` suppresses the "it saved" toast. */
export function afterTaskPatch(
  result: unknown,
  opts: { silent?: boolean; successMessage?: string } = {},
): void {
  // Kept as the single place a task PATCH reply is turned into UI, even though
  // the reply currently raises nothing beyond "it saved": concurrent clocks no
  // longer split time, so there is no longer a split to announce.
  void result

  if (!opts.silent) toast.success(opts.successMessage ?? "Updated")
}
