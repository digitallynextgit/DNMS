import * as React from "react"

import { cn } from "@/lib/utils"

// =============================================================================
// The ONE calendar colour key - the swatch row under a month grid. The
// attendance calendar and the holiday calendar each had a private copy of it
// (`LegendItem` / `LegendSwatch`).
// =============================================================================

export interface CalendarLegendItem {
  /** Swatch fill classes, e.g. "bg-green-100 dark:bg-green-950/40". */
  swatch: string
  label: string
}

interface CalendarLegendProps {
  items: CalendarLegendItem[]
  /** Extra entries that aren't a colour swatch (e.g. an icon key). */
  children?: React.ReactNode
  className?: string
}

export function CalendarLegend({ items, children, className }: CalendarLegendProps) {
  return (
    <div className={cn("mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px]", className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded", item.swatch)} />
          <span className="text-muted-foreground">{item.label}</span>
        </span>
      ))}
      {children}
    </div>
  )
}
