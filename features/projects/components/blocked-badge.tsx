import { Ban } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * "Blocked" marker for a task that is waiting on a requirement.
 *
 * Renders nothing when there is no requirement, so call sites can drop it in
 * without a conditional. The requirement's title is in the tooltip rather than
 * the badge - on a Kanban card there is no room, and the answer to "blocked by
 * what?" is one hover away.
 */
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
