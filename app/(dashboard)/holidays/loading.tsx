import {
  PageHeaderSkeleton,
  StatCardSkeleton,
  ListSkeleton,
} from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function HolidaysLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="flex items-center justify-between gap-2">
        <Skeleton className="bg-muted h-9 w-72 animate-pulse rounded-sm" />
        <div className="flex items-center gap-2">
          <Skeleton className="bg-muted h-9 w-28 animate-pulse rounded-sm" />
          <Skeleton className="bg-muted h-9 w-32 animate-pulse rounded-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <ListSkeleton rows={6} height="h-14" />
    </div>
  )
}
