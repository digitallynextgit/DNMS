import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  /** The raw status/enum value, e.g. "APPROVED". */
  status: string
  /** Map of value -> Tailwind color classes (e.g. LEAVE_STATUS_COLORS from lib/constants). */
  colorMap: Record<string, string>
  /** Optional map of value -> human label (e.g. LEAVE_STATUS_LABELS). Falls back to the raw value. */
  labelMap?: Record<string, string>
  /** Override the displayed text (wins over labelMap/status). */
  label?: string
  size?: "sm" | "xs"
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
  size = "sm",
  fallbackColor = "bg-muted text-muted-foreground",
  className,
}: StatusBadgeProps) {
  const text = label ?? labelMap?.[status] ?? status
  const color = colorMap[status] ?? fallbackColor
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full font-medium",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        color,
        className,
      )}
    >
      {text}
    </span>
  )
}
