"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// =============================================================================
// The ONE month stepper: "August 2025  ‹ ›". Every month-scoped view (attendance
// calendars, holiday calendar) used to hand-roll this pair of icon buttons.
// =============================================================================

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

interface MonthNavProps {
  year: number
  /** 0-11 */
  month: number
  onPrev: () => void
  onNext: () => void
  canPrev?: boolean
  canNext?: boolean
  /** Hide the month/year label when the surrounding header already prints it. */
  showLabel?: boolean
  className?: string
}

export function MonthNav({
  year,
  month,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  showLabel = true,
  className,
}: MonthNavProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      {showLabel && (
        <h3 className="text-foreground text-sm font-semibold">
          {MONTH_NAMES[month]} {year}
        </h3>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
