import { Skeleton } from "@/components/ui/skeleton"

// Mirrors AlbumView: a back-link header (back button above title) with an action
// button, then the square photo/video grid (grid-cols-2 sm:grid-cols-4
// lg:grid-cols-5, aspect-square).
export default function AlbumLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 py-4">
        <Skeleton className="bg-muted h-8 w-32 animate-pulse rounded-sm" />
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Skeleton className="bg-muted h-5 w-48 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-24 animate-pulse" />
          </div>
          <Skeleton className="bg-muted h-9 w-44 shrink-0 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted aspect-square w-full animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
