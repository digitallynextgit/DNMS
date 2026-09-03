import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Resignations review skeleton: header + a stack of resignation request cards
 * (avatar + name/designation/applied lines on the left, Decline / Approve
 * buttons on the right), mirroring the real card so nothing reflows on load.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex flex-col gap-4 rounded-sm border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="flex min-w-0 gap-3">
              <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-sm" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="bg-muted h-4 w-44 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-56 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-40 animate-pulse" />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Skeleton className="bg-muted h-8 w-24 animate-pulse rounded-sm" />
              <Skeleton className="bg-muted h-8 w-24 animate-pulse rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
