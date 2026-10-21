"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme"
import { formatMonthShort } from "../lib/calendar-months"
import { useGoalSeriesHistory } from "../hooks/use-goals"
import { fmtNumber } from "./goal-number"

/** Target against reached for every month of a repeating goal, and each service's share. */
export function GoalGrowthDialog({
  projectId,
  seriesId,
  onClose,
}: {
  projectId: string
  seriesId: string | null
  onClose: () => void
}) {
  const { data, isLoading } = useGoalSeriesHistory(projectId, seriesId)
  const months = data?.months ?? []
  const chart = months.map((m) => ({
    month: formatMonthShort(`${m.month}-01`),
    Target: m.targetValue ?? 0,
    Reached: m.actualValue ?? 0,
  }))
  // Every service that had a part in any month, in first-seen order.
  const parts = [...new Set(months.flatMap((m) => m.parts.map((p) => p.title)))]

  return (
    <Dialog open={seriesId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Growth · {data?.title ?? "Recurring goal"}</DialogTitle>
          <DialogDescription>
            Every month&rsquo;s target against what was reached
            {data?.metricLabel ? ` (${data.metricLabel})` : ""}.
            {data?.stoppedAt && " This goal has stopped repeating; its months stay as history."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Skeleton className="h-72 rounded-sm" />
        ) : months.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">No months yet.</p>
        ) : (
          <>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => fmtNumber(v)}
                    width={56}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    formatter={(v) => fmtNumber(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Reached" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Line
                    dataKey="Target"
                    type="stepAfter"
                    stroke="hsl(var(--foreground))"
                    strokeDasharray="4 3"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Month</th>
                    <th className="px-3 py-2 text-right font-medium">Target</th>
                    <th className="px-3 py-2 text-right font-medium">Reached</th>
                    <th className="px-3 py-2 text-right font-medium">%</th>
                    {parts.map((p) => (
                      <th key={p} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...months].reverse().map((m) => (
                    <tr key={m.month}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatMonthShort(`${m.month}-01`)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtNumber(m.targetValue)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {fmtNumber(m.actualValue)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          m.progress >= 100
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {m.progress}%
                      </td>
                      {parts.map((p) => {
                        const part = m.parts.find((x) => x.title === p)
                        return (
                          <td
                            key={p}
                            className="px-3 py-2 text-right whitespace-nowrap tabular-nums"
                          >
                            {part ? (
                              <>
                                {fmtNumber(part.actualValue)}
                                <span className="text-muted-foreground">
                                  {" "}
                                  / {fmtNumber(part.targetValue)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
