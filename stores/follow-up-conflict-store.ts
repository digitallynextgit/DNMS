import { create } from "zustand"
import type { FollowUpConflictDetails } from "@/features/projects/lib/follow-up-conflict"

/**
 * The pending "keep it or remove it?" question about a hold follow-up.
 *
 * Shared state because the two halves live apart: the question is RAISED
 * wherever a task status is changed (the sheet, the kanban, the detail panel,
 * My Tasks) and ANSWERED by a single dialog mounted once in the dashboard
 * shell. Without this, every one of those screens would need its own copy of
 * the dialog and they would drift.
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
