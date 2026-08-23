import { Skeleton } from "@/components/ui/skeleton"
import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

// Careers: header (no actions) + a two-tab strip + a toolbar row (breadcrumb +
// add button) + a grid of large navigational tiles (groups / sub-depts / roles).
export default function Loading() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />

      {/* Tabs: Full-time / Internships. */}
      <div className="flex gap-2">
        <Skeleton className="bg-muted h-9 w-32 animate-pulse rounded-[2px]" />
        <Skeleton className="bg-muted h-9 w-32 animate-pulse rounded-[2px]" />
      </div>

      {/* Toolbar: breadcrumb on the left, "Add group" on the right. */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="bg-muted h-5 w-28 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-28 animate-pulse" />
      </div>

      {/* Large tile grid. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card flex min-h-47.5 flex-col rounded-[2px] border p-6 shadow-sm"
          >
            <Skeleton className="bg-muted h-3 w-12 animate-pulse" />
            <Skeleton className="bg-muted mt-3 h-7 w-3/4 animate-pulse" />
            <div className="mt-auto flex items-end justify-between gap-2 pt-6">
              <Skeleton className="bg-muted h-3 w-40 animate-pulse" />
              <Skeleton className="bg-muted h-6 w-16 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
