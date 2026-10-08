import { Ban } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/** Renders nothing without a requirement; the requirement's title is in the tooltip. */
export function BlockedBadge({
  requirement,
  className,
}: {
  requirement?: { id: string; title: string; status: string } | null
  className?: string
}) {
  if (!requirement) return null
  return (
    <Badge
      variant="outline"
      title={`Blocked by requirement: ${requirement.title}`}
      className={cn(
        "gap-1 border-red-300 py-0 text-[10px] text-red-700 dark:border-red-900/60 dark:text-red-400",
        className,
      )}
    >
      <Ban className="h-3 w-3" />
      Blocked
    </Badge>
  )
}
