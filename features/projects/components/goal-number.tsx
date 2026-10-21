"use client"

import { cn } from "@/lib/utils"
import { ProgressBar, type GoalNode } from "./goal-status"

/** Indian grouping: 1,20,000. */
export const fmtNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? "-" : Math.round(n).toLocaleString("en-IN")

/** "2,140 / 3,000 Orders" with its bar, a tick where it should be by today, and how far off pace. */
export function GoalNumber({ goal, compact }: { goal: GoalNode; compact?: boolean }) {
  if (goal.targetValue === null) return null
  const actual = goal.actualValue ?? 0
  const target = goal.targetValue
  const pace = goal.paceValue
  const done = goal.status === "DONE"
  const gap = pace !== null ? pace - actual : 0
  const behind = !done && pace !== null && gap > 0
  const pacePct = pace !== null ? Math.min(100, (pace / target) * 100) : null

  return (
    <div className={cn("shrink-0", compact ? "w-40" : "w-48")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("font-semibold tabular-nums", compact ? "text-xs" : "text-sm")}>
          {fmtNumber(actual)}
          <span className="text-muted-foreground font-normal"> / {fmtNumber(target)}</span>
        </span>
        <span className="text-muted-foreground text-[11px] tabular-nums">{goal.progress}%</span>
      </div>
      <div className="relative mt-1.5">
        <ProgressBar value={goal.progress} />
        {/* Where it should be by today at a steady rate. */}
        {pacePct !== null && !done && (
          <span
            aria-hidden
            title={`Should be about ${fmtNumber(pace)} by today`}
            className="bg-foreground/70 absolute -top-0.5 h-2.5 w-0.5 rounded-full"
            style={{ left: `calc(${pacePct}% - 1px)` }}
          />
        )}
      </div>
      <p
        className={cn(
          "mt-1 truncate text-[10px]",
          behind ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        )}
      >
        {goal.metricLabel}
        {pace !== null && !done && (behind ? ` · ${fmtNumber(gap)} behind pace` : " · on pace")}
        {goal.actualSource === "META_PURCHASES" && " · from Meta"}
      </p>
    </div>
  )
}
