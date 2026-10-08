import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

export default function WfhRequestsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <div className="border-border bg-card rounded-sm border">
          <TableSkeleton rows={6} cols={7} />
        </div>
      </div>
    </div>
  )
}
