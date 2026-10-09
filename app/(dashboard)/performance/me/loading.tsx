import { Skeleton } from "@/components/ui/skeleton"
import {
  DataTableSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-4">
        <Skeleton className="bg-muted h-9 w-56 animate-pulse rounded-sm" />
        <DataTableSkeleton cols={6} rows={4} filters={1} />
      </div>

      <div className="border-border bg-card rounded-sm border">
        <div className="space-y-2 p-5 pb-3">
          <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
          <Skeleton className="bg-muted h-3 w-72 animate-pulse" />
        </div>
        <TableSkeleton rows={4} cols={3} serial={false} />
      </div>
    </div>
  )
}
