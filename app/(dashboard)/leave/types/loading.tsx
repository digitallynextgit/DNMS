import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Leave Types & Policy: header (tabs + New Leave Type button) over a bordered
// DataTable panel. 8 data columns + serial/select, so cols=9.
export default function LeaveTypesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={10} cols={9} />
      </div>
    </div>
  )
}
