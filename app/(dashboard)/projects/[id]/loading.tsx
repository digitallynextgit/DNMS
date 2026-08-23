import { Skeleton } from "@/components/ui/skeleton"

/**
 * Project detail: a header (logo + name + code + status/priority + Edit) → the
 * tab bar → the Overview body (a 4-cell stat strip, the account-manager card,
 * then the progress overview chart). The tab bodies stream in on activation, so
 * this reserves the header + overview shell the page mounts into.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header: back link, logo, title + code, status/priority + Edit */}
      <div className="space-y-4 py-4">
        <Skeleton className="bg-muted h-3 w-28 animate-pulse" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded" />
            <div className="space-y-2">
              <Skeleton className="bg-muted h-5 w-48 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-8 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-8 w-28 animate-pulse" />
            <Skeleton className="bg-muted h-8 w-16 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-border flex flex-wrap items-center gap-2 border-b pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-8 w-24 animate-pulse rounded" />
        ))}
      </div>

      {/* Overview: stat strip */}
      <div className="border-border bg-card rounded-[2px] border">
        <div className="divide-border grid grid-cols-2 divide-x sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
              <Skeleton className="bg-muted h-6 w-10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Account manager + info card */}
      <div className="border-border bg-card space-y-4 rounded-[2px] border p-5">
        <div className="space-y-2">
          <Skeleton className="bg-muted h-3 w-32 animate-pulse" />
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-full" />
            <div className="space-y-2">
              <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-48 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 border-t pt-3 sm:grid-cols-3">
          <Skeleton className="bg-muted h-4 w-24 animate-pulse" />
          <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
        </div>
      </div>

      {/* Progress overview chart */}
      <Skeleton className="bg-muted h-64 w-full animate-pulse rounded" />
    </div>
  )
}
