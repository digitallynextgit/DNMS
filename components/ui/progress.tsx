"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0-100. Clamped. */
  value?: number
  /**
   * No known total yet - render a sliding bar instead of a fraction. Use this only
   * when the progress genuinely cannot be measured; a fake determinate bar is worse
   * than an honest indeterminate one.
   */
  indeterminate?: boolean
}

export function Progress({ value = 0, indeterminate, className, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct}
      className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      {indeterminate ? (
        <div className="bg-primary absolute inset-y-0 w-1/3 animate-[progress-slide_1.2s_ease-in-out_infinite] rounded-full" />
      ) : (
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  )
}
