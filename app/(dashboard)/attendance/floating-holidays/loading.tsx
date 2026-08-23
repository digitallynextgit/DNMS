import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Floating Holidays: header (no actions), a year stepper + usage badge row, then
// a grid of selectable optional-holiday cards. Mirrors the page's own isLoading
// branch (CardGridSkeleton) so nothing reflows between the two skeleton phases.
export default function FloatingHolidaysLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="bg-muted h-8 w-20 animate-pulse rounded" />
          <Skeleton className="bg-muted h-7 w-14 animate-pulse rounded" />
          <Skeleton className="bg-muted h-8 w-20 animate-pulse rounded" />
        </div>
        <Skeleton className="bg-muted h-7 w-28 animate-pulse rounded" />
      </div>

      <CardGridSkeleton count={6} />
    </div>
  )
}
