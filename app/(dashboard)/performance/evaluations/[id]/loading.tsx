import { Skeleton } from "@/components/ui/skeleton"

// Evaluation scorecard: back + title/description + print action, a status/score
// summary card, then side-by-side scorecards (Manager + Self) of rating rows.
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 py-4">
        <Skeleton className="bg-muted h-8 w-40 animate-pulse rounded-sm" />
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="bg-muted h-5 w-64 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-56 animate-pulse" />
          </div>
          <Skeleton className="bg-muted h-9 w-36 animate-pulse rounded-sm" />
        </div>
      </div>

      {/* Status / final score summary */}
      <div className="border-border bg-card rounded-sm border">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-6">
            <div className="space-y-1.5">
              <Skeleton className="bg-muted h-3 w-10 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-16 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="bg-muted h-3 w-14 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-16 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1.5 text-right">
            <Skeleton className="bg-muted ml-auto h-3 w-20 animate-pulse" />
            <Skeleton className="bg-muted ml-auto h-8 w-24 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Scorecards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SidePanelSkeleton />
        <SidePanelSkeleton />
      </div>
    </div>
  )
}

/** A scorecard panel: tinted header + two sections of criterion rows, each with
 *  five 7x7 rating buttons and a score cell. */
function SidePanelSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-sm border">
      <div className="bg-muted/40 flex items-center justify-between border-b px-5 py-3">
        <Skeleton className="bg-muted h-4 w-36 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-20 animate-pulse" />
      </div>
      <div className="divide-y">
        {Array.from({ length: 2 }).map((_, section) => (
          <div key={section}>
            <div className="flex items-center justify-between px-4 py-2">
              <Skeleton className="bg-muted h-3.5 w-32 animate-pulse" />
              <Skeleton className="bg-muted h-3.5 w-10 animate-pulse" />
            </div>
            {Array.from({ length: 4 }).map((_, row) => (
              <div key={row} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
                  <Skeleton className="bg-muted h-3 w-8 animate-pulse" />
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, n) => (
                    <Skeleton key={n} className="bg-muted h-7 w-7 animate-pulse rounded-sm" />
                  ))}
                </div>
                <Skeleton className="bg-muted h-4 w-6 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
