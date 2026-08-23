import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

// Storage: header (view toggle + Add storage) + a grid of connected-bucket cards.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-52 animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
