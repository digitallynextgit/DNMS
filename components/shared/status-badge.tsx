import * as React from "react"

import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  /** Optional leading glyph (e.g. CheckCircle2 for a "Configured" pill). */
  icon?: React.ElementType
  /** The raw status/enum value, e.g. "APPROVED". */
  status: string
  /** Map of value -> Tailwind color classes (e.g. LEAVE_STATUS_COLORS from lib/constants). */
  colorMap: Record<string, string>
  /** Optional map of value -> human label (e.g. LEAVE_STATUS_LABELS). Falls back to the raw value. */
  labelMap?: Record<string, string>
  /** Override the displayed text (wins over labelMap/status). */
  label?: string
  /** "sm"/"xs" = the classic pill. "button" = a squared chip the same height and
   *  radius as a `size="sm"` Button, for sitting in a row of buttons. */
  size?: "sm" | "xs" | "button"
  /** Classes used when `status` is not in `colorMap`. */
  fallbackColor?: string
  className?: string
}

/**
 * One pill renderer for every status/badge in the app. Pass a color map (and
 * usually a label map) from `lib/constants.ts` - e.g.
 *   <StatusBadge status={req.status} colorMap={LEAVE_STATUS_COLORS} labelMap={LEAVE_STATUS_LABELS} />
 * Replaces the ~55 hand-copied `<span className="… rounded-full …">` pills.
 */
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
          ? "h-8 rounded-lg border border-current/20 px-3 text-sm"
          : size === "xs"
            ? "rounded-full px-2 py-0.5 text-[10px]"
            : "rounded-full px-2.5 py-0.5 text-xs",
        color,
        className,
      )}
    >
      {Icon && <Icon className={size === "button" ? "h-4 w-4" : "h-3 w-3"} />}
      {text}
    </span>
  )
}
