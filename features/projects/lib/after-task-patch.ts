import { toast } from "sonner"

// Turns a task PATCH reply into UI, shared by every screen that moves a task. Client-safe.

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
  // Nothing in the reply needs announcing yet beyond "it saved".
  void result

  if (!opts.silent) toast.success(opts.successMessage ?? "Updated")
}
