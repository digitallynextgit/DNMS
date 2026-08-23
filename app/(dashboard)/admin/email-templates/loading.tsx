import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Email Templates: header (with a Create action) + the templates DataTable.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withActions />

      {/* DataTable: bordered card + header row + rows + pagination footer.
          Columns: S.No, Name, Slug, Subject, Trigger, Active, Last Updated. */}
      <div className="border-border bg-card rounded-[2px] border">
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
