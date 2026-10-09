import { Skeleton } from "@/components/ui/skeleton"
import { DataTableSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

export default function WfhLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <Skeleton className="bg-muted h-24 w-full animate-pulse rounded-sm" />
      <DataTableSkeleton cols={6} rows={5} selectable />
    </div>
  )
}
