import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the sales-channels page: custom heading then a 3-up card grid, each
// card being a title + provider line, a stat number, and a footer line.
export default function PortalChannelsLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="bg-muted h-6 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-80 animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-card rounded-sm border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="bg-muted h-4 w-2/3 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-1/3 animate-pulse" />
              </div>
              <Skeleton className="bg-muted h-5 w-16 shrink-0 animate-pulse rounded-full" />
            </div>
            <Skeleton className="bg-muted mt-3 h-5 w-24 animate-pulse" />
            <Skeleton className="bg-muted mt-2 h-3 w-32 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
