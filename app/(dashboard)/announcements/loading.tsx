import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Announcements board skeleton: header (with the "New announcement" action), the
 * single divided 4-up stat strip, the month/category filter toolbar, then a
 * stack of announcement cards, matching the real board so nothing reflows.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Stat strip: one card, a divided 4-up row */}
      <div className="border-border bg-card rounded-sm border">
        <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
              <Skeleton className="bg-muted h-7 w-12 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter toolbar: two selects */}
      <div className="flex items-center gap-2">
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
      </div>

      {/* Announcement cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card space-y-2 rounded-sm border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-16 animate-pulse rounded-sm" />
              <Skeleton className="bg-muted h-4 w-20 animate-pulse rounded-sm" />
            </div>
            <Skeleton className="bg-muted h-3 w-32 animate-pulse" />
            <Skeleton className="bg-muted h-3 w-full animate-pulse" />
            <Skeleton className="bg-muted h-3 w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
