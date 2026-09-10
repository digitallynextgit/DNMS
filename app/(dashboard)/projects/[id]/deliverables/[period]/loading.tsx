import { Skeleton } from "@/components/ui/skeleton"

/**
 * One deliverable: a back link and title, the tracker card, the team tabs,
 * then the lines. Reserves that shape so the page does not jump as it arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 py-4">
        <Skeleton className="bg-muted h-3 w-32 animate-pulse" />
        <Skeleton className="bg-muted h-6 w-64 animate-pulse" />
        <Skeleton className="bg-muted h-3 w-96 animate-pulse" />
      </div>

      {/* Tracker: donut and legend, then the tiles, bar and team rows. */}
      <div className="border-border bg-card space-y-4 rounded-sm border p-5">
        <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
        <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:gap-6">
          <div className="flex items-center gap-4">
            <Skeleton className="bg-muted h-32 w-32 shrink-0 animate-pulse rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="bg-muted h-3 w-24 animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="bg-muted h-16 animate-pulse rounded-sm" />
              ))}
            </div>
            <Skeleton className="bg-muted h-2 w-full animate-pulse rounded-full" />
          </div>
        </div>
        <div className="space-y-2 border-t pt-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="bg-muted h-6 w-full animate-pulse" />
          ))}
        </div>
      </div>

      {/* Team tabs */}
      <div className="flex gap-2">
        <Skeleton className="bg-muted h-8 w-24 animate-pulse rounded-sm" />
        <Skeleton className="bg-muted h-8 w-24 animate-pulse rounded-sm" />
      </div>

      {/* The lines */}
      <div className="border-border bg-card rounded-sm border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border flex items-center gap-4 border-b px-4 py-3">
            <Skeleton className="bg-muted h-4 w-6 animate-pulse" />
            <Skeleton className="bg-muted h-4 flex-1 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-5 w-16 animate-pulse rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
