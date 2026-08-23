import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// My Performance: title-only header, a tabs bar (My Evaluations / To Review) with
// period + status filters, the evaluations table, and the rating-scale reference.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-4">
        {/* Tabs list + filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="bg-muted h-9 w-56 animate-pulse rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-[170px] animate-pulse rounded" />
            <Skeleton className="bg-muted h-9 w-[150px] animate-pulse rounded" />
          </div>
        </div>

        {/* Active tab's table */}
        <div className="border-border bg-card rounded-[2px] border">
          <TableSkeleton rows={4} cols={6} />
        </div>
      </div>

      {/* Performance rating scale reference */}
      <div className="border-border bg-card rounded-[2px] border">
        <div className="space-y-2 p-5 pb-3">
          <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
          <Skeleton className="bg-muted h-3 w-72 animate-pulse" />
        </div>
        <TableSkeleton rows={4} cols={3} />
      </div>
    </div>
  )
}
