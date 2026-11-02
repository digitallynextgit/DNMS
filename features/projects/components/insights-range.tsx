"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { DateRangePicker, type DayRange } from "./date-range-picker"
import type { IntegrationRange } from "../hooks/use-integration"

// The range bar above each synced dashboard on Analytics (Meta Ads, Shopify): preset spans, a
// custom span, when it last synced and Sync now.

const ALL_RANGE = "all"

const RANGES: { label: string; days?: number }[] = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "All", days: undefined },
]

export function useInsightsRange(initialDays = 30) {
  const [rangeDays, setRangeDays] = useState<number | undefined>(initialDays)
  // Overrides the preset rather than replacing it, so clearing it falls back to the last preset.
  const [customRange, setCustomRange] = useState<DayRange | undefined>()
  const range: IntegrationRange = customRange
    ? { from: customRange.from, to: customRange.to }
    : { days: rangeDays }
  const rangeKey = customRange ? `${customRange.from}~${customRange.to}` : String(rangeDays)
  return { range, rangeKey, rangeDays, setRangeDays, customRange, setCustomRange }
}

export type InsightsRangeState = ReturnType<typeof useInsightsRange>

export function InsightsRangeBar({
  state,
  lastSyncedAt,
  canManage,
  onSync,
  syncing,
}: {
  state: InsightsRangeState
  lastSyncedAt: string | null | undefined
  canManage: boolean
  onSync: () => void
  syncing: boolean
}) {
  const { rangeDays, setRangeDays, customRange, setCustomRange } = state
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        aria-label="Date range"
        // "All" has no day count, so it needs a sentinel value.
        value={rangeDays === undefined ? ALL_RANGE : String(rangeDays)}
        // A preset is only "on" when no custom span is overriding it.
        muted={Boolean(customRange)}
        onChange={(days) => {
          setRangeDays(days === ALL_RANGE ? undefined : Number(days))
          setCustomRange(undefined)
        }}
        options={RANGES.map((r) => ({
          value: r.days === undefined ? ALL_RANGE : String(r.days),
          label: r.label,
        }))}
      />

      <DateRangePicker
        value={customRange}
        onChange={setCustomRange}
        onClear={() => setCustomRange(undefined)}
      />
      {lastSyncedAt && (
        <span className="text-muted-foreground text-xs">
          Last synced {new Date(lastSyncedAt).toLocaleString("en-IN")}
        </span>
      )}
      {canManage && (
        <Button variant="outline" className="ml-auto" onClick={onSync} loading={syncing}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sync now
        </Button>
      )}
    </div>
  )
}
