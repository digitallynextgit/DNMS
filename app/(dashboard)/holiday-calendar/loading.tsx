import { PageHeaderSkeleton, StatCardSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Employee Holiday Calendar: header with tabs/year actions, a 2-up stat strip,
// then the default (calendar) tab: a month stepper above the month grid.
export default function HolidayCalendarLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="bg-muted h-5 w-40 animate-pulse rounded-sm" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-8 w-8 animate-pulse rounded-sm" />
            <Skeleton className="bg-muted h-8 w-8 animate-pulse rounded-sm" />
          </div>
        </div>
        <div className="bg-card rounded-sm border p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={`h-${i}`}
                className="bg-muted mx-auto h-3 w-8 animate-pulse rounded-sm"
              />
            ))}
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="bg-muted min-h-19 animate-pulse rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
