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

// One-of-N filter strip (date presets, view modes, status filters), built to the same h-9 geometry
// as TabsList / ViewToggle. The track scrolls rather than wraps, so every option is reachable on phones.

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
              // shrink-0 so options keep their size inside the scrolling track.
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
