"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { AlertTriangle, Check, Trash2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-fetch"
import { useFollowUpConflictStore } from "@/stores/follow-up-conflict-store"

/**
 * Asks what to do with a hold follow-up whose original task has already been
 * picked up again.
 *
 * Mounted ONCE in the dashboard shell: the question can be raised from the task
 * sheet, the kanban, the detail panel or My Tasks, and one dialog answering for
 * all of them is what keeps the wording and the two outcomes identical
 * everywhere.
 */
export function FollowUpConflictDialog() {
  const conflict = useFollowUpConflictStore((s) => s.conflict)
  const dismiss = useFollowUpConflictStore((s) => s.dismiss)
  const qc = useQueryClient()
  const [busy, setBusy] = useState<"keep" | "remove" | null>(null)

  if (!conflict) return null

  const originalState =
    conflict.originalStatus === "DONE" ? "has already been completed" : "is already in progress"

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-tasks"] })
    qc.invalidateQueries({ queryKey: ["team-tasks"] })
    qc.invalidateQueries({ queryKey: ["project-all-tasks"] })
  }

  const handleKeep = async () => {
    setBusy("keep")
    try {
      await conflict.keep()
      dismiss()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the task")
    } finally {
      setBusy(null)
    }
  }

  const handleRemove = async () => {
    setBusy("remove")
    try {
      await apiFetch(`/api/tasks/${conflict.taskId}`, { method: "DELETE" })
      refresh()
      toast.success("Follow-up task removed")
      dismiss()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the task")
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && dismiss()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            This follow-up may not be needed
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-foreground font-medium">
                  &quot;{conflict.originalTitle}&quot;
                </span>{" "}
                {originalState}, so the work this follow-up was carrying is being handled there.
              </p>
              <p>Keep this task anyway, or remove it?</p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={dismiss} disabled={!!busy}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleKeep} disabled={!!busy}>
              <Check className="mr-2 h-4 w-4" />
              {busy === "keep" ? "Keeping..." : "Keep it"}
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={!!busy}>
              <Trash2 className="mr-2 h-4 w-4" />
              {busy === "remove" ? "Removing..." : "Remove task"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
