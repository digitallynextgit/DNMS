"use client"

import { useState } from "react"
import { History } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { TaskTimeline } from "./task-timeline"

/** Owns its trigger and open state; the timeline only fetches while open. */
export function TaskHistoryDialog({
  taskId,
  taskTitle,
  iconOnly = false,
  className,
}: {
  taskId: string
  taskTitle: string
  iconOnly?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="Activity log: created, started, and every status change"
          aria-label={`Activity log for ${taskTitle}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center rounded-sm transition-colors",
            iconOnly ? "size-7 justify-center" : "gap-1 px-1.5 py-0.5 text-[11px]",
            className,
          )}
        >
          <History className="h-3.5 w-3.5 shrink-0" />
          {!iconOnly && "History"}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Activity log</DialogTitle>
          <DialogDescription className="text-xs">{taskTitle}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <TaskTimeline taskId={taskId} open={open} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
