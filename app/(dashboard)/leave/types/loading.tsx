import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// 8 data columns + serial/select, so cols=9.
export default function LeaveTypesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={10} cols={9} />
      </div>
    </div>
  )
}
