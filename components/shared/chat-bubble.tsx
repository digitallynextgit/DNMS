"use client"

// Bubble surfaces shared by Chat and project Messages. Outgoing is a 20% primary wash (a solid fill
// glares in dark themes); incoming is bg-muted, distinct from both background and card.

import { cn } from "@/lib/utils"

export const BUBBLE_OUT = "bg-primary/20 text-foreground"
export const BUBBLE_IN = "bg-muted text-foreground"

/** The pointed corner on a run's first bubble. Its fills MUST match BUBBLE_OUT / BUBBLE_IN. */
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

export function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="bg-card text-muted-foreground rounded-sm border px-2.5 py-0.5 text-[10px]">
        {label}
      </span>
    </div>
  )
}
