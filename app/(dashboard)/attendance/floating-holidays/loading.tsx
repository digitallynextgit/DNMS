import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function FloatingHolidaysLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="bg-muted h-8 w-20 animate-pulse rounded-sm" />
          <Skeleton className="bg-muted h-7 w-14 animate-pulse rounded-sm" />
          <Skeleton className="bg-muted h-8 w-20 animate-pulse rounded-sm" />
        </div>
        <Skeleton className="bg-muted h-7 w-28 animate-pulse rounded-sm" />
      </div>

      <CardGridSkeleton count={6} />
    </div>
  )
}
