import { StatCardsSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Employee attendance detail: back link + avatar/identity header with a month
// stepper, a 4-up stat strip, then the month calendar grid.
export default function EmployeeAttendanceLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="bg-muted h-4 w-32 animate-pulse rounded-sm" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-sm" />
            <div className="space-y-2">
              <Skeleton className="bg-muted h-6 w-40 animate-pulse rounded-sm" />
              <Skeleton className="bg-muted h-4 w-32 animate-pulse rounded-sm" />
            </div>
          </div>
          <Skeleton className="bg-muted h-9 w-44 animate-pulse rounded-sm" />
        </div>
      </div>

      <StatCardsSkeleton count={4} />

      <div className="bg-card rounded-sm border p-4">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={`h-${i}`}
              className="bg-muted mx-auto h-3 w-8 animate-pulse rounded-sm"
            />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="bg-muted min-h-19 animate-pulse rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  )
}
