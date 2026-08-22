"use client"

/**
 * The surfaces every message bubble is drawn on, shared by personal Chat and a
 * project's Messages tab so the two threads look like the same product.
 *
 * Outgoing used to be a SOLID fill - `bg-primary` in chat, `bg-emerald-600` in
 * project messages. Primary is near-white in every dark theme, so chat put a
 * glaring white slab on an almost-black thread; emerald put a loud green one
 * there instead. A 20% wash of the theme's own primary keeps "this one is mine"
 * as a colour - and follows a custom palette's hue for free - without the glare,
 * and `text-foreground` stays readable on it in light and dark alike.
 *
 * Incoming is `bg-muted`: the one neutral surface distinct from BOTH
 * --background and --card in every theme, so it reads as a bubble whichever of
 * those the thread canvas uses.
 */

import { cn } from "@/lib/utils"

export const BUBBLE_OUT = "bg-primary/20 text-foreground"
export const BUBBLE_IN = "bg-muted text-foreground"

/**
 * The pointed corner on the first bubble of a run. An SVG rather than a rotated
 * square: it takes the bubble's exact background token in both themes, so there
 * is never a seam where the two shapes meet.
 *
 * Its fills MUST track BUBBLE_OUT / BUBBLE_IN exactly.
 */
export function BubbleTail({ side }: { side: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 8 10"
      aria-hidden
      className={cn(
        "absolute top-0 h-2.5 w-2",
        side === "right" ? "fill-primary/20 -right-2" : "fill-muted -left-2",
      )}
    >
      <path d={side === "right" ? "M0 0 L8 0 Q8 8 0 10 Z" : "M8 0 L0 0 Q0 8 8 10 Z"} />
    </svg>
  )
}

/** The centred day chip between runs of messages from different days. */
export function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="bg-card text-muted-foreground rounded-sm border px-2.5 py-0.5 text-[10px]">
        {label}
      </span>
    </div>
  )
}
