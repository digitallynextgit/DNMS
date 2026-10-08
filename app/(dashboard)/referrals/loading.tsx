import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withActions />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-sm border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="bg-muted h-9 w-9 shrink-0 animate-pulse rounded-sm" />
              <div className="space-y-2">
                <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
                <Skeleton className="bg-muted h-6 w-14 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-20 w-full animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
