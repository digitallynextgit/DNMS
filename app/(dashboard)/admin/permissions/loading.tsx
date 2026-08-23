import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Permission Matrix: header (no actions) + a single card holding the wide
// role x permission table.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="border-border bg-card rounded-[2px] border">
        <div className="border-border border-b px-6 py-4">
          <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
        </div>
        <div className="p-6">
          <TableSkeleton rows={10} cols={8} />
        </div>
      </div>
    </div>
  )
}
