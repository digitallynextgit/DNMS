import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <Skeleton className="bg-muted h-9 w-72 animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="bg-muted h-72 animate-pulse rounded-sm" />
        <Skeleton className="bg-muted h-72 animate-pulse rounded-sm" />
      </div>
    </div>
  )
}
