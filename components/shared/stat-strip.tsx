import * as React from "react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// =============================================================================
// The ONE compact summary strip: a single divided row of label/value cells
// inside a Card. Five pages used to hand-roll this grid plus their own private
// `Stat` / `SummaryStat` / `SummaryCard` cell - don't write another one.
// =============================================================================

const TONE_CLASSES = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
} as const

/**
 * Tailwind can't see interpolated class names, so the column count is a lookup
 * of literal classes: always 2-up on mobile, N-up from `sm:`.
 */
const COLUMN_CLASSES: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-6",
}

export interface StatStripItem {
  label: string
  value: React.ReactNode
  /** Renders value as small text rather than a big number (e.g. a currency string). */
  isText?: boolean
  tone?: keyof typeof TONE_CLASSES
  /** Optional glyph rendered before the label. */
  icon?: React.ElementType
  /** Small muted unit printed after the value ("days", "requests"). */
  suffix?: string
}

interface StatStripProps {
  items: StatStripItem[]
  /** Draws each value as a skeleton in the cell's real shape (no layout shift). */
  loading?: boolean
  className?: string
}

export function StatStrip({ items, loading = false, className }: StatStripProps) {
  const columns = COLUMN_CLASSES[items.length] ?? COLUMN_CLASSES[4]

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div className={cn("divide-border grid divide-x divide-y sm:divide-y-0", columns)}>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {Icon && <Icon className="text-muted-foreground h-3 w-3" />}
                  <p className="text-muted-foreground text-[10px] font-medium tracking-widest uppercase">
                    {item.label}
                  </p>
                </div>
                {loading ? (
                  <Skeleton className={cn("mt-1", item.isText ? "h-5 w-24" : "h-7 w-12")} />
                ) : (
                  <p className="mt-1 flex items-baseline gap-1">
                    <span
                      className={cn(
                        "tabular-nums",
                        item.isText ? "text-sm font-medium" : "text-xl font-bold",
                        TONE_CLASSES[item.tone ?? "default"],
                      )}
                    >
                      {item.value}
                    </span>
                    {item.suffix && (
                      <span className="text-muted-foreground text-[11px]">{item.suffix}</span>
                    )}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
