import * as React from "react"

import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  /** Optional leading glyph (e.g. CheckCircle2 for a "Configured" pill). */
  icon?: React.ElementType
  status: string
  /** e.g. LEAVE_STATUS_COLORS from lib/constants. */
  colorMap: Record<string, string>
  /** e.g. LEAVE_STATUS_LABELS; falls back to the raw value. */
  labelMap?: Record<string, string>
  /** Wins over labelMap / status. */
  label?: string
  /** "button" = a squared chip with a Button's height (36px) and radius. */
  size?: "sm" | "xs" | "button"
  /** Classes used when `status` is not in `colorMap`. */
  fallbackColor?: string
  className?: string
}

export function StatusBadge({
  status,
  colorMap,
  labelMap,
  label,
  icon: Icon,
  size = "sm",
  fallbackColor = "bg-muted text-muted-foreground",
  className,
}: StatusBadgeProps) {
  const text = label ?? labelMap?.[status] ?? status
  const color = colorMap[status] ?? fallbackColor
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 font-medium",
        size === "button"
          ? "h-8 rounded-sm border border-current/20 px-3 text-sm"
          : size === "xs"
            ? "rounded-sm px-2 py-0.5 text-[10px]"
            : "rounded-sm px-2.5 py-0.5 text-xs",
        color,
        className,
      )}
    >
      {Icon && <Icon className={size === "button" ? "h-4 w-4" : "h-3 w-3"} />}
      {text}
    </span>
  )
}
