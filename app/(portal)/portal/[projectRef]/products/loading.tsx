import { Skeleton } from "@/components/ui/skeleton"

// Mirrors the products page: custom heading, a search-bar row, then the
// responsive product-card grid (2/3/4 cols) of aspect-square-ish h-64 cards -
// the same grid the client shows while its own query loads.
export default function PortalProductsLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="bg-muted h-6 w-32 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-80 animate-pulse" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="bg-muted h-9 w-full max-w-xs animate-pulse" />
        <Skeleton className="bg-muted h-4 w-20 animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-64 w-full animate-pulse rounded-sm" />
        ))}
      </div>
    </div>
  )
}
