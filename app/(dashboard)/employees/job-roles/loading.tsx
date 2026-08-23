import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function JobRolesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <Skeleton className="bg-muted h-9 w-56 animate-pulse" />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  )
}
