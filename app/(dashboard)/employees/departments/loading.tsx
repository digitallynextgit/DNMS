import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function DepartmentsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <Skeleton className="bg-muted h-9 w-full max-w-sm animate-pulse" />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={10} cols={7} />
      </div>
    </div>
  )
}
