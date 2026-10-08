import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-4 py-4">
        <Skeleton className="bg-muted h-3 w-28 animate-pulse" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-sm" />
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

      <div className="border-border flex flex-wrap items-center gap-2 border-b pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-8 w-24 animate-pulse rounded-sm" />
        ))}
      </div>

      <div className="border-border bg-card rounded-sm border">
        <div className="divide-border grid grid-cols-2 divide-x sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
              <Skeleton className="bg-muted h-6 w-10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="border-border bg-card space-y-4 rounded-sm border p-5">
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

      <Skeleton className="bg-muted h-64 w-full animate-pulse rounded-sm" />
    </div>
  )
}
