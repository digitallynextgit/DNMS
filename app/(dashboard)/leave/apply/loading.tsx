import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

// Apply for Leave: a two-pane form (fields on the left, live mail preview on
// the right) laid out in `lg:grid-cols-2`, matching ApplyLeaveForm.
export default function ApplyLeaveLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="grid w-full gap-6 lg:grid-cols-2">
        {/* Left: form fields */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="bg-muted h-3.5 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="bg-muted h-3.5 w-20 animate-pulse" />
              <Skeleton className="bg-muted h-9 w-full animate-pulse" />
            </div>
            <div className="space-y-2">
              <Skeleton className="bg-muted h-3.5 w-20 animate-pulse" />
              <Skeleton className="bg-muted h-9 w-full animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-4 w-4 animate-pulse rounded" />
            <Skeleton className="bg-muted h-3.5 w-32 animate-pulse" />
          </div>
          <div className="space-y-2">
            <Skeleton className="bg-muted h-3.5 w-16 animate-pulse" />
            <Skeleton className="bg-muted h-20 w-full animate-pulse" />
          </div>
          <div className="flex items-center justify-end gap-3">
            <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
          </div>
        </div>

        {/* Right: mail preview card */}
        <div className="border-border bg-card space-y-4 rounded-[2px] border p-5">
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
