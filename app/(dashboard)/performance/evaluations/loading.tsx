import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Performance Evaluations: header with actions (KPI Profiles / Generate / New),
// a filter row (search + period + status), then the evaluations table
// (Employee, Period, Manager, Status, Score, Open + S.No).
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Filter row: search input + two selects. */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="bg-muted h-9 w-full max-w-xs animate-pulse rounded-sm sm:w-[320px]" />
        <Skeleton className="bg-muted h-9 w-[170px] animate-pulse rounded-sm" />
        <Skeleton className="bg-muted h-9 w-[150px] animate-pulse rounded-sm" />
      </div>

      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={10} cols={7} />
      </div>
    </div>
  )
}
