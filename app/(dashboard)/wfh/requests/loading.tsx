import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// HR/admin WFH inbox: a plain header (no actions) over the requests table.
// The inbox table has 7 columns (Employee, Date, Reason, Type, Manager,
// Status, Action).
export default function WfhRequestsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <div className="border-border bg-card rounded-[2px] border">
          <TableSkeleton rows={6} cols={7} />
        </div>
      </div>
    </div>
  )
}
