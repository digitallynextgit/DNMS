"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { PERFORMANCE_BANDS, type PerformanceTone } from "@/features/performance/performance"

const RANGE_CELL: Record<PerformanceTone, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
}

/**
 * The performance rating scale - how a final score maps to a rating and the
 * resulting action/outcome. Shown to every employee. Pass `highlightPct` (0–100)
 * to emphasise the band a given score falls into.
 */
export function PerformanceScale({ highlightPct }: { highlightPct?: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Performance rating scale</CardTitle>
        <p className="text-muted-foreground text-xs">
          How your final score maps to a rating and the outcome.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="px-4 py-2 font-medium">Score Range</th>
                <th className="px-4 py-2 font-medium">Performance Rating</th>
                <th className="px-4 py-2 font-medium">Action / Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {PERFORMANCE_BANDS.map((b) => {
                const active =
                  highlightPct != null &&
                  highlightPct >= b.min &&
                  !PERFORMANCE_BANDS.some((o) => o.min > b.min && highlightPct >= o.min)
                return (
                  <tr key={b.range} className={cn(active && "bg-primary/5")}>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-block rounded px-2 py-0.5 text-xs font-semibold",
                          RANGE_CELL[b.tone],
                        )}
                      >
                        {b.range}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      {b.rating}
                      {active && (
                        <span className="text-primary ml-2 text-[11px] font-semibold">· You</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-2.5">{b.action}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
