import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Mirrors DocsPage: header (no actions), a search + role-tabs row, then the 3-up
// module-card grid (icon tile, title, description, tags + "Read Guide" button).
export default function DocsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* Search + role filter tabs. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="bg-muted h-9 w-full animate-pulse sm:max-w-xs" />
        <Skeleton className="bg-muted h-9 w-72 animate-pulse rounded-sm" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-border bg-card flex flex-col gap-4 rounded-sm border p-6">
            <Skeleton className="bg-muted h-11 w-11 animate-pulse rounded-sm" />
            <div className="flex-1 space-y-2">
              <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-full animate-pulse" />
              <Skeleton className="bg-muted h-3 w-4/5 animate-pulse" />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex gap-1">
                <Skeleton className="bg-muted h-5 w-14 animate-pulse rounded-full" />
                <Skeleton className="bg-muted h-5 w-14 animate-pulse rounded-full" />
              </div>
              <Skeleton className="bg-muted h-8 w-24 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
