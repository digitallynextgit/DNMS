import { PageHeaderSkeleton, ChartSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Progress: header (project picker + date range) → a 6-up strip of icon stat
 * cards → the AI-insights card → the portfolio charts (or per-project detail).
 * Reserve that exact space so numbers and charts land without a reflow.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Stat tiles: grid-cols-2 / md:grid-cols-3 / lg:grid-cols-6, each an
          icon box + label + value */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-sm border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="bg-muted h-9 w-9 shrink-0 animate-pulse rounded-sm" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="bg-muted h-3 w-2/3 animate-pulse" />
                <Skeleton className="bg-muted h-5 w-1/2 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI insights card: title + action buttons */}
      <div className="border-border bg-card rounded-sm border p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="bg-muted h-4 w-28 animate-pulse" />
            <Skeleton className="bg-muted h-3 w-48 animate-pulse" />
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton className="bg-muted h-8 w-20 animate-pulse" />
            <Skeleton className="bg-muted h-8 w-36 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Portfolio charts */}
      <ChartSkeleton />
    </div>
  )
}
