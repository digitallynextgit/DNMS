import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <Skeleton className="bg-muted h-12 animate-pulse rounded-sm" />
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="bg-muted h-48 animate-pulse rounded-sm" />
      ))}
    </div>
  )
}
