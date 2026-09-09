"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import {
  TAB_TRACK,
  TAB_TRACK_SCROLL,
  TAB_TRIGGER,
  TAB_TRIGGER_ACTIVE,
  TAB_TRIGGER_IDLE,
} from "@/components/ui/tabs"

// ─────────────────────────────────────────────────────────────────────────────
// A one-of-N filter strip: date presets, view modes, status filters.
//
// ONE component because there were three byte-identical copies of it (the
// Progress range bar, the Insights range bar, the Storage status filter), and
// they had already drifted a step out of line with the real Tabs. A filter
// strip is a tab strip as far as the eye is concerned, so it is built to the
// SAME geometry as TabsList / ViewToggle:
//
//   h-9 track + p-1  ->  h-7 inside, 4px of padding on every side.
//
// h-9 is the app's control height - Button (default), Input and ViewToggle are
// all h-9 - so a strip sitting in a toolbar lines up with whatever is beside
// it instead of floating a few pixels short.
//
// The track scrolls rather than wrapping for the same reason TabsList does:
// five presets are wider than a 390px phone and `main` clips the overflow, so
// without this the last option is simply unreachable there.
// ─────────────────────────────────────────────────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Tooltip / accessible name when the label is an icon or an abbreviation. */
  title?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  /** Renders the strip as unselected - a custom range is overriding it. */
  muted = false,
  "aria-label": ariaLabel,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly SegmentedOption<T>[]
  muted?: boolean
  "aria-label"?: string
  className?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(TAB_TRACK, TAB_TRACK_SCROLL, className)}
    >
      {options.map((o) => {
        const active = !muted && o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              // shrink-0 so options keep their size inside the scrolling track
              // rather than compressing into each other on a narrow screen.
              TAB_TRIGGER,
              active ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER_IDLE,
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
