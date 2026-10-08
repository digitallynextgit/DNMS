import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

export default function DevicesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={8} cols={7} />
      </div>
    </div>
  )
}
