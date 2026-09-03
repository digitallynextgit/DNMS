import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Audit Log: header + a filters bar, a summary line, then the audit DataTable.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Filters row: module select, action search, two date inputs. */}
      <div className="bg-card border-border flex flex-wrap gap-3 rounded-sm border p-4">
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-9 min-w-[180px] flex-1 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
      </div>

      {/* Summary line ("Showing N of M entries"). */}
      <Skeleton className="bg-muted h-5 w-56 animate-pulse" />

      {/* DataTable: bordered card + header row + rows + pagination footer. */}
      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={10} cols={7} />
        <div className="border-border flex items-center justify-between border-t px-4 py-3">
          <Skeleton className="bg-muted h-3 w-28 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-16 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
