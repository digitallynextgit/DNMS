"use client"

// Tabs that don't fit spill onto a second strip. A hidden one-line row (at the active, widest weight)
// measures true tab widths; a ResizeObserver recomputes the split.

import * as React from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ProjectTabItem {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Optional count pill (unread messages, open requirements). */
  badge?: number
  badgeClassName?: string
}

/** Matches TabsTrigger's box. `[&_svg]:size-4` matters: bare lucide icons are 24px and would over-measure. */
const MEASURE_ITEM =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap [&_svg]:size-4 [&_svg]:shrink-0"

/** Mirrors TabsList's own padding (p-1) and the gap-1 between triggers. */
const TRACK_PADDING = 8
const ITEM_GAP = 4

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[10px] leading-none font-semibold text-white",
        className ?? "bg-destructive",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function ProjectTabsBar({ items }: { items: ProjectTabItem[] }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const measureRef = React.useRef<HTMLDivElement>(null)
  // Start with everything on strip one; the layout effect corrects it before paint.
  const [splitAt, setSplitAt] = React.useState(items.length)

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const recalc = () => {
      const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth)
      const available = container.clientWidth - TRACK_PADDING
      if (available <= 0) return

      let used = 0
      let fits = 0
      for (let i = 0; i < widths.length; i++) {
        const next = (widths[i] ?? 0) + (i > 0 ? ITEM_GAP : 0)
        if (used + next > available) break
        used += next
        fits++
      }
      // Never leave strip one empty, even on an absurdly narrow viewport.
      setSplitAt(Math.max(1, fits))
    }

    recalc()
    const observer = new ResizeObserver(recalc)
    observer.observe(container)
    return () => observer.disconnect()
    // Re-measure when the tab set or a badge changes - both change tab widths.
  }, [items])

  const primary = items.slice(0, splitAt)
  const overflow = items.slice(splitAt)

  const renderTrigger = (item: ProjectTabItem) => {
    const Icon = item.icon
    return (
      <TabsTrigger key={item.value} value={item.value}>
        <Icon />
        {item.label}
        {!!item.badge && item.badge > 0 && (
          <Badge count={item.badge} className={item.badgeClassName} />
        )}
      </TabsTrigger>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      {/* Hidden yardstick. Plain spans, not TabsTriggers: duplicates would register duplicate values with Radix. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap"
      >
        {items.map((item) => {
          const Icon = item.icon
          return (
            <span key={item.value} className={MEASURE_ITEM}>
              <Icon />
              {item.label}
              {!!item.badge && item.badge > 0 && (
                <Badge count={item.badge} className={item.badgeClassName} />
              )}
            </span>
          )
        })}
      </div>

      {/* Full width, so justify-start is needed or the tabs would centre. */}
      <TabsList className="h-auto min-h-9 w-full justify-start gap-1">
        {primary.map(renderTrigger)}
      </TabsList>

      {overflow.length > 0 && (
        <TabsList className="h-auto min-h-9 w-full justify-start gap-1">
          {overflow.map(renderTrigger)}
        </TabsList>
      )}
    </div>
  )
}
