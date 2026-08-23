import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Recruitment landing skeleton: header + a 3-up stat row (icon tile + number +
 * label), a status filter-chip strip, then the job-posting card grid
 * (sm:grid-cols-2 lg:grid-cols-3) so nothing reflows when the postings arrive.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Stats (3-up: icon tile + number + label) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-[2px] border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-[2px]" />
              <div className="space-y-2">
                <Skeleton className="bg-muted h-6 w-12 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-6 w-16 animate-pulse rounded-[2px]" />
        ))}
      </div>

      {/* Job-posting card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card space-y-3 rounded-[2px] border p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
              <Skeleton className="bg-muted h-5 w-16 shrink-0 animate-pulse rounded" />
            </div>
            <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="bg-muted h-3 w-20 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
            </div>
            <Skeleton className="bg-muted h-7 w-full animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
