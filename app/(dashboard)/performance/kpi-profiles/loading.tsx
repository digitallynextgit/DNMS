import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// KPI Profiles: a title-only header, a search box, then the employee table
// (Employee, Department, Manager KPIs, Self KPIs, Status, Edit + S.No).
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-4">
        <Skeleton className="bg-muted h-9 w-full max-w-xs animate-pulse rounded" />
        <div className="border-border bg-card rounded-[2px] border">
          <TableSkeleton rows={10} cols={7} />
        </div>
      </div>
    </div>
  )
}
