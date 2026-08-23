import { Skeleton } from "@/components/ui/skeleton"

// Mirrors GuideDetailPage: back-link header + title/desc, a "For:" role-badge
// row, a divider, then the prose guide content (constrained to max-w-3xl).
export default function GuideDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-2 py-4">
          <Skeleton className="bg-muted h-8 w-40 animate-pulse rounded-sm" />
          <div className="space-y-2">
            <Skeleton className="bg-muted h-5 w-56 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-80 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="bg-muted h-4 w-8 animate-pulse" />
          <Skeleton className="bg-muted h-5 w-16 animate-pulse rounded-full" />
          <Skeleton className="bg-muted h-5 w-16 animate-pulse rounded-full" />
        </div>
      </div>

      <div className="border-border border-t" />

      <div className="max-w-3xl space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="bg-muted h-5 w-48 animate-pulse" />
            <Skeleton className="bg-muted h-4 w-full animate-pulse" />
            <Skeleton className="bg-muted h-4 w-full animate-pulse" />
            <Skeleton className="bg-muted h-4 w-3/4 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
