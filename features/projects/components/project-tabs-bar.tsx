"use client"

// =============================================================================
// Tab bar that spills its OVERFLOW onto a second strip
// =============================================================================
// Plain `flex-wrap` gets the behaviour right - only what doesn't fit moves down
// - but everything stays inside one track, so the wrapped items read as a ragged
// edge rather than a second bar. Moving items into a DIFFERENT container can't
// be expressed in CSS, so the split point is measured.
//
// How it stays honest:
//   • A hidden row holds every tab on one line at all times. Tab widths are
//     intrinsic (they don't change with the container), so it is the one place
//     that always knows how wide each tab really is - the visible strips can't
//     tell us, because once an item moves to strip two it is no longer being
//     measured against strip one.
//   • The hidden row is measured at `font-semibold`, the ACTIVE weight and
//     therefore the widest a tab can ever be. Measuring the lighter idle weight
//     would under-estimate and let the active tab overhang.
//   • A ResizeObserver recomputes on every container resize, so the split
//     follows the window instead of being decided once at mount.
// =============================================================================

import * as React from "react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ProjectTabItem {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Optional count pill (unread messages, open requirements). */
  badge?: number
  /** Tailwind background for the badge. */
  badgeClassName?: string
}

/** Matches TabsTrigger's box exactly, so the hidden row measures true widths. */
const MEASURE_ITEM =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold whitespace-nowrap"

/** Mirrors TabsList's own padding (p-1) and the gap-1 between triggers. */
const TRACK_PADDING = 8
const ITEM_GAP = 4

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-[2px] px-1 text-[10px] leading-none font-semibold text-white",
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
  // Start with everything on strip one; the layout effect corrects it before
  // paint, so there is no flash of a wrongly-split bar.
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
      // Never strand strip one empty: on an absurdly narrow viewport one tab
      // still sits up top and the rest spill, rather than the whole bar
      // collapsing into the overflow strip.
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
      <TabsTrigger key={item.value} value={item.value} className="gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {item.label}
        {!!item.badge && item.badge > 0 && (
          <Badge count={item.badge} className={item.badgeClassName} />
        )}
      </TabsTrigger>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full space-y-1">
      {/* Hidden yardstick: every tab, one line, never wrapped. aria-hidden and
          absolutely positioned so it costs no layout space and is invisible to
          assistive tech. Plain spans, not TabsTriggers - duplicating real
          triggers would register duplicate values with Radix. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap"
      >
        {items.map((item) => {
          const Icon = item.icon
          return (
            <span key={item.value} className={MEASURE_ITEM}>
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {!!item.badge && item.badge > 0 && (
                <Badge count={item.badge} className={item.badgeClassName} />
              )}
            </span>
          )
        })}
      </div>

      {/* sm:justify-start looks redundant beside justify-start, and is not: the
          base TabsList sets `sm:justify-center`, and tailwind-merge keeps a
          breakpoint variant and its unprefixed form as SEPARATE classes. Without
          the variant here these strips were left-aligned on a phone and centred
          on every larger screen, which showed as a half-empty second row
          floating in the middle. */}
      <TabsList className="h-auto min-h-10 w-full justify-start gap-1 sm:justify-start">
        {primary.map(renderTrigger)}
      </TabsList>

      {/* Second strip appears ONLY when something actually overflows. */}
      {overflow.length > 0 && (
        <TabsList className="h-auto min-h-10 w-full justify-start gap-1 sm:justify-start">
          {overflow.map(renderTrigger)}
        </TabsList>
      )}
    </div>
  )
}
