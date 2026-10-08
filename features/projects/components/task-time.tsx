"use client"

import { useEffect, useState } from "react"
import { Clock, Timer } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatHours } from "../lib/format-hours"

interface Props {
  /** Time allocated on the work allocation sheet. */
  estimatedHours: number | null | undefined
  /** Time banked from previous In Progress stretches. */
  loggedHours: number | null | undefined
  /** Set while the clock is running; the live stretch is added on top. */
  inProgressSince?: string | null
  /** `inline` for a dense card footer, `stacked` for the detail sheet. */
  variant?: "inline" | "stacked"
  className?: string
}

/** Hours since `since` (0 when stopped) - the whole stretch, matching what settleRunningTasks banks. */
function elapsedHoursSince(since: string | null | undefined): number {
  if (!since) return 0
  const ms = Date.now() - new Date(since).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

/** Re-renders every 30s, under the smallest unit shown (1 minute). */
function useTick(active: boolean, everyMs = 30_000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((n) => n + 1), everyMs)
    return () => clearInterval(id)
  }, [active, everyMs])
}

/** Allocated vs spent (banked + the running stretch); amber once spent passes allocated. */
export function TaskTime({
  estimatedHours,
  loggedHours,
  inProgressSince,
  variant = "inline",
  className,
}: Props) {
  const running = !!inProgressSince
  useTick(running)

  const spent = (loggedHours ?? 0) + elapsedHoursSince(inProgressSince)
  const hasEstimate = estimatedHours != null && estimatedHours > 0
  const hasSpent = spent > 0

  if (!hasEstimate && !hasSpent) return null

  const over = hasEstimate && spent > estimatedHours

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs", className)}>
        {hasEstimate && (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Allocated {formatHours(estimatedHours)}
          </span>
        )}
        {(hasSpent || running) && (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              over ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <Timer className={cn("h-3.5 w-3.5", running && "animate-pulse")} />
            Spent {formatHours(spent)}
            {running && <span className="text-[10px] uppercase">running</span>}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", className)}
      title={
        hasEstimate
          ? `Allocated ${formatHours(estimatedHours)}, spent ${formatHours(spent)}`
          : `Spent ${formatHours(spent)}`
      }
    >
      {hasEstimate && (
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Allocated {formatHours(estimatedHours)}
        </span>
      )}
      {(hasSpent || running) && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5",
            over ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          <Timer className={cn("h-3.5 w-3.5 shrink-0", running && "animate-pulse text-blue-500")} />
          Spent {formatHours(spent)}
          {running && (
            <span className="rounded-sm bg-blue-500/10 px-1 text-[10px] text-blue-500">
              running
            </span>
          )}
        </span>
      )}
    </div>
  )
}
