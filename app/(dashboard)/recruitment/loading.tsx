import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-sm border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-sm" />
              <div className="space-y-2">
                <Skeleton className="bg-muted h-6 w-12 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-6 w-16 animate-pulse rounded-sm" />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card space-y-3 rounded-sm border p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
              <Skeleton className="bg-muted h-5 w-16 shrink-0 animate-pulse rounded-sm" />
            </div>
            <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="bg-muted h-3 w-20 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
            </div>
            <Skeleton className="bg-muted h-7 w-full animate-pulse rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
