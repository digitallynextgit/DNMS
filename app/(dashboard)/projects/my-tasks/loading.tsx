import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * My Tasks: header (person picker + New Task) → a 3-cell summary strip → a
 * filter/view-toggle row → the day-grouped task cards. Mirror that order so the
 * page doesn't jump when the query resolves.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Summary strip: Total · Done · Overdue */}
      <div className="border-border bg-card rounded-sm border">
        <div className="divide-border grid grid-cols-3 divide-x">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
              <Skeleton className="bg-muted h-6 w-10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter + view toggle row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="bg-muted h-8 w-48 animate-pulse" />
          <Skeleton className="bg-muted h-8 w-36 animate-pulse" />
          <Skeleton className="bg-muted h-8 w-40 animate-pulse" />
        </div>
        <Skeleton className="bg-muted h-8 w-20 animate-pulse" />
      </div>

      {/* Day-grouped task cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-14 w-full animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
