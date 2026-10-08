import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={8} cols={8} />
      </div>
    </div>
  )
}
