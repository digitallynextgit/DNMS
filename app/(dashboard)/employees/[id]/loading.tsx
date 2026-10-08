import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeeProfileLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      <div className="border-border bg-card rounded-sm border p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <Skeleton className="bg-muted h-24 w-24 shrink-0 animate-pulse rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="bg-muted h-7 w-56 animate-pulse" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-28 animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="bg-muted h-5 w-20 animate-pulse" />
              <Skeleton className="bg-muted h-5 w-24 animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-4">
              <Skeleton className="bg-muted h-4 w-44 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-9 w-24 animate-pulse" />
        ))}
      </div>

      <div className="border-border bg-card space-y-6 rounded-sm border p-6">
        <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
