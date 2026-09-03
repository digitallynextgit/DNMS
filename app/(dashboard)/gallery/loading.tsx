import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Mirrors GalleryView: header + action, a 4-cell stat strip, a filter row, then
// the 4-up album grid (aspect-[4/3] cover + title/meta), so nothing reflows.
export default function GalleryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Stat strip: one card, four divided cells (Albums / Photos / Videos / week). */}
      <div className="border-border bg-card rounded-sm border">
        <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
              <Skeleton className="bg-muted h-6 w-10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Filter toolbar: search on the left, two selects on the right. */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="bg-muted h-9 w-full animate-pulse sm:w-64" />
        <Skeleton className="bg-muted ml-auto h-9 w-36 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
      </div>

      {/* Album grid. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card overflow-hidden rounded-sm border">
            <Skeleton className="bg-muted aspect-[4/3] w-full animate-pulse rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
