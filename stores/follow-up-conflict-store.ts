import { create } from "zustand"
import type { FollowUpConflictDetails } from "@/features/projects/lib/follow-up-conflict"

/**
 * The pending "keep or remove the hold follow-up?" question: raised wherever a task status
 * changes, answered by one dialog in the dashboard shell.
 */
export interface FollowUpConflict extends FollowUpConflictDetails {
  /** Re-run the rejected status change, this time confirmed. */
  keep: () => void | Promise<void>
}

interface FollowUpConflictStore {
  conflict: FollowUpConflict | null
  ask: (conflict: FollowUpConflict) => void
  dismiss: () => void
}

export const useFollowUpConflictStore = create<FollowUpConflictStore>((set) => ({
  conflict: null,
  ask: (conflict) => set({ conflict }),
  dismiss: () => set({ conflict: null }),
}))
