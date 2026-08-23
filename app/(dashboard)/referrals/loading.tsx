import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * My Referrals skeleton: header (with the "Refer someone" action), a 4-up stat
 * row (grid-cols-2 lg:grid-cols-4, each an icon tile + label + value), then a
 * stack of referral cards, matching the real page so nothing reflows on load.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withActions />

      {/* Stat row: icon tile + label + value */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-[2px] border">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="bg-muted h-9 w-9 shrink-0 animate-pulse rounded" />
              <div className="space-y-2">
                <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
                <Skeleton className="bg-muted h-6 w-14 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Referral cards */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-20 w-full animate-pulse rounded-[2px]" />
        ))}
      </div>
    </div>
  )
}
