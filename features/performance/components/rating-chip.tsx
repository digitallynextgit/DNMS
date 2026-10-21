"use client"

import { Award } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useEvaluations } from "../hooks/use-evaluations"
import { bandForPercent, scorePercent, type PerformanceTone } from "../performance"

// A soft wash in the band's colour, no border - it sits among borderless icon buttons.
const TONE: Record<PerformanceTone, string> = {
  green: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400",
}

/**
 * The top bar's always-there rating: the latest signed-off score in its band's colour, opening My
 * Performance. Same query as the dashboard tile, so the two never disagree and share one fetch.
 */
export function RatingChip() {
  const { data, isLoading } = useEvaluations({ mine: true, limit: 20 })
  if (isLoading) return null
  const mine = data?.data ?? []
  // Newest first. Only signed-off reviews count: a score can exist before the final sign-off.
  const latest = mine.find((ev) => ev.status === "COMPLETED" && ev.finalScore != null)
  const pct = latest ? Math.round(scorePercent(latest.finalScore!) * 10) / 10 : null
  const band = pct != null ? bandForPercent(pct) : null
  const inProgress = mine.some((ev) => ev.status !== "COMPLETED")
  const tip =
    band && latest
      ? `My rating: ${band.rating} (${pct}/100), from your ${latest.periodLabel} review.`
      : inProgress
        ? "My rating: your first review is in progress."
        : "My rating: no review yet."

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/performance/me"
            aria-label={tip}
            className={cn(
              "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-sm font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
              band
                ? TONE[band.tone]
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Award className="h-4 w-4 shrink-0" />
            {pct ?? "-"}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
