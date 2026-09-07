import { create } from "zustand"

import type { PlannedDeliverable } from "@/features/projects/lib/after-task-patch"

/**
 * The pending "you finished this - what did it produce?" prompt.
 *
 * Shared state for the same reason the hold follow-up question is: a task is
 * marked done from many places (My Tasks, the sheet, the kanban, the detail
 * panel) and the capture dialog is mounted ONCE in the dashboard shell. Every
 * completion path just calls `ask`; nothing has to carry its own copy of the
 * form.
 *
 * Deliberately a queue of one. Two completions in quick succession show the
 * second prompt after the first is answered or skipped, never two dialogs.
 */
export interface OutputCapture {
  taskId: string
  projectId: string
  title: string
  links: string[]
  /** Who made it - the task's assignee, which may not be the person clicking. */
  employeeId: string | null
  /** yyyy-MM-dd, the task's start date if it had one. */
  startedOn: string | null
  /**
   * The row already owed for this task, when there is one. The prompt then
   * confirms that promise rather than opening a blank form - a planned reel and
   * the reel that was made are ONE row, not two.
   */
  planned: PlannedDeliverable | null
}

interface OutputCaptureStore {
  pending: OutputCapture | null
  queue: OutputCapture[]
  ask: (c: OutputCapture) => void
  /** Answered or skipped: advance to the next queued prompt, if any. */
  dismiss: () => void
}

export const useOutputCaptureStore = create<OutputCaptureStore>((set, get) => ({
  pending: null,
  queue: [],
  ask: (c) => {
    const { pending, queue } = get()
    if (!pending) set({ pending: c })
    else if (!queue.some((q) => q.taskId === c.taskId) && pending.taskId !== c.taskId) {
      set({ queue: [...queue, c] })
    }
  },
  dismiss: () => {
    const [next, ...rest] = get().queue
    set({ pending: next ?? null, queue: rest })
  },
}))
