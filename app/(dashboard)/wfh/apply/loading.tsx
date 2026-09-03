import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

// Apply for WFH: a two-pane form (eligibility + fields on the left, a live mail
// preview on the right) in `lg:grid-cols-2`, matching the real page.
export default function ApplyWfhLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid w-full gap-6 lg:grid-cols-2">
        {/* Left: eligibility banner + fields */}
        <div className="space-y-6">
          <Skeleton className="bg-muted h-32 w-full animate-pulse rounded-sm" />
          <div className="space-y-2">
            <Skeleton className="bg-muted h-3.5 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-full animate-pulse" />
          </div>
          <div className="space-y-2">
            <Skeleton className="bg-muted h-3.5 w-16 animate-pulse" />
            <Skeleton className="bg-muted h-20 w-full animate-pulse" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-44 animate-pulse" />
          </div>
        </div>

        {/* Right: mail preview card */}
        <div className="border-border bg-card space-y-4 rounded-sm border p-5">
          <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
          <div className="space-y-2">
            <Skeleton className="bg-muted h-3 w-1/3 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-full animate-pulse" />
          </div>
          <div className="space-y-2 pt-2">
            <Skeleton className="bg-muted h-3 w-full animate-pulse" />
            <Skeleton className="bg-muted h-3 w-full animate-pulse" />
            <Skeleton className="bg-muted h-3 w-5/6 animate-pulse" />
            <Skeleton className="bg-muted h-3 w-full animate-pulse" />
            <Skeleton className="bg-muted h-3 w-2/3 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
