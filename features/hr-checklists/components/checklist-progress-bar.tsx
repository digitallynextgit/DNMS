"use client"

import { cn } from "@/lib/utils"
import type { ChecklistProgressView } from "../types"

/**
 * Progress for one checklist: the overall bar, plus the clearance count when
 * there are any.
 *
 * The clearance number is called out separately because it is the one that
 * decides anything - 20 of 24 items done means nothing if the four outstanding
 * are the sign-offs blocking somebody's relieving letter.
 */
export function ChecklistProgressBar({
  progress,
  showClearances = true,
  className,
}: {
  progress: ChecklistProgressView
  showClearances?: boolean
  className?: string
}) {
  const complete = progress.total > 0 && progress.done === progress.total
  const clearancesOutstanding = progress.clearancesTotal - progress.clearancesDone

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <div
          className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checklist progress"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              complete ? "bg-green-500" : "bg-primary",
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
          {progress.percent}%
        </span>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {progress.done} of {progress.total} done
        {showClearances && progress.clearancesTotal > 0 && (
          <>
            {" · "}
            <span className={cn(clearancesOutstanding > 0 && "text-amber-600 dark:text-amber-400")}>
              {progress.clearancesDone}/{progress.clearancesTotal} clearances signed
            </span>
          </>
        )}
      </p>
    </div>
  )
}
