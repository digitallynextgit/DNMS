import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the inventory page: custom heading, a 3-up stat strip (label + big
// number), then the "Needs attention" table (4 columns) in a bordered card.
export default function PortalInventoryLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="bg-muted h-6 w-36 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-80 animate-pulse" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-sm border p-4">
            <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
            <Skeleton className="bg-muted mt-2 h-8 w-16 animate-pulse" />
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="bg-muted mb-3 h-4 w-32 animate-pulse" />
        <div className="overflow-x-auto rounded-sm border">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    </div>
  )
}
