import {
  PageHeaderSkeleton,
  ListSkeleton,
  StatCardsSkeleton,
} from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <StatCardsSkeleton count={4} />
      <ListSkeleton rows={3} height="h-48" />
    </div>
  )
}
