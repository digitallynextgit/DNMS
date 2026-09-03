import { PageHeaderSkeleton, StatCardsSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// My Attendance: header with a month stepper, a 4-up stat strip, then the month
// calendar grid.
export default function MyAttendanceLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

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
