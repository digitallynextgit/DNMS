import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={4} />
      <Skeleton className="bg-muted h-80 animate-pulse rounded-sm" />
    </div>
  )
}
