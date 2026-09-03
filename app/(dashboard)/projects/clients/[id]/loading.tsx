import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/shared/loading-skeleton"

export default function ClientLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <StatCardsSkeleton count={4} />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={5} cols={5} />
      </div>
    </div>
  )
}
