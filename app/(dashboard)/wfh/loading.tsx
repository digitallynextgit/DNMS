import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Work From Home landing: header (+ Apply WFH) + an eligibility card + the
// request-history table, matching the non-manager My WFH view.
export default function WfhLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <Skeleton className="bg-muted h-24 w-full animate-pulse rounded-sm" />

      <div className="space-y-3">
        <Skeleton className="bg-muted h-3 w-32 animate-pulse" />
        <div className="border-border bg-card rounded-sm border">
          <TableSkeleton rows={5} cols={6} />
        </div>
      </div>
    </div>
  )
}
