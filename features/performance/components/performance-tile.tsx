"use client"

import { Award } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useEvaluations } from "../hooks/use-evaluations"
import {
  BANDS_LOW_TO_HIGH,
  bandForPercent,
  scalePosition,
  scorePercent,
  type PerformanceTone,
} from "../performance"

const TONE_TEXT: Record<PerformanceTone, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
}
const TONE_BAR: Record<PerformanceTone, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
}

/**
 * Dashboard stat tile: your latest signed-off score, its rating, and a pointer on the six bands.
 * Small on purpose - the full scale and history are on My Performance, one click away.
 */
export function PerformanceTile({ className }: { className?: string }) {
  const { data, isLoading } = useEvaluations({ mine: true, limit: 20 })
  const mine = data?.data ?? []
  // Newest first. Only signed-off reviews count: a score can exist before the final sign-off.
  const latest = mine.find((ev) => ev.status === "COMPLETED" && ev.finalScore != null)
  const pct = latest ? scorePercent(latest.finalScore!) : null
  const band = pct != null ? bandForPercent(pct) : null
  const inProgress = mine.some((ev) => ev.status !== "COMPLETED")

  return (
    <Link
      href="/performance/me"
      className={cn("focus-visible:ring-ring block rounded-sm focus-visible:ring-2", className)}
      title={
        band && latest
          ? `${band.rating}: ${band.action}. From your ${latest.periodLabel} review.`
          : undefined
      }
    >
      <Card className="border-border bg-card hover:border-foreground/25 h-full rounded-sm border transition-colors">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                My Rating
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-2xl font-semibold tracking-tight tabular-nums",
                      band ? TONE_TEXT[band.tone] : "text-foreground",
                    )}
                  >
                    {pct != null ? Math.round(pct * 10) / 10 : "-"}
                  </span>
                  {pct != null && <span className="text-muted-foreground text-xs">/100</span>}
                </p>
              )}
              <p className="text-muted-foreground truncate text-xs">
                {band
                  ? band.rating.replace(/ Performer$/, "")
                  : inProgress
                    ? "First review in progress"
                    : "No review yet"}
              </p>
            </div>
            <Award className="text-muted-foreground h-4 w-4 shrink-0" />
          </div>

          {/* The six bands, low to high, with a dot where the score sits. */}
          <div className="relative mt-3" aria-hidden>
            <div className="flex h-1.5 gap-0.5">
              {BANDS_LOW_TO_HIGH.map((b) => (
                <span
                  key={b.range}
                  className={cn(
                    "flex-1 first:rounded-l-full last:rounded-r-full",
                    TONE_BAR[b.tone],
                    b === band ? "opacity-100" : "opacity-25",
                  )}
                />
              ))}
            </div>
            {pct != null && (
              <span
                className="bg-foreground border-card absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                style={{ left: `${Math.min(96, Math.max(4, scalePosition(pct)))}%` }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
