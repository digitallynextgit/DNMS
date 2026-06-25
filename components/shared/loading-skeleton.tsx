import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-0">
      <div className="border-border flex items-center gap-4 border-b px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn(
              "bg-muted h-3 animate-pulse",
              i === 0 ? "w-32" : i === cols - 1 ? "ml-auto w-16" : "flex-1",
            )}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-border flex items-center gap-4 border-b px-4 py-3 last:border-0"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={cn(
                "bg-muted h-3 animate-pulse",
                colIdx === 0 ? "w-32" : colIdx === cols - 1 ? "ml-auto w-16" : "flex-1",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({
  rows = 6,
  height = "h-14",
  className,
}: {
  rows?: number
  height?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("bg-muted w-full animate-pulse rounded", height)} />
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-border bg-card rounded-[var(--radius)] border p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
              <Skeleton className="bg-muted h-7 w-1/3 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-3/4 animate-pulse" />
            </div>
            <Skeleton className="bg-muted h-4 w-4 shrink-0 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="bg-muted h-3.5 w-24 animate-pulse" />
          <Skeleton className="bg-muted h-9 w-full animate-pulse" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between py-4">
        <div className="space-y-1.5">
          <Skeleton className="bg-muted h-5 w-40 animate-pulse" />
          <Skeleton className="bg-muted h-4 w-64 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
          <Skeleton className="bg-muted h-9 w-28 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-[var(--radius)] border p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
                <Skeleton className="bg-muted h-6 w-1/3 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-2/3 animate-pulse" />
              </div>
              <Skeleton className="bg-muted h-4 w-4 shrink-0 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-border bg-card rounded-[var(--radius)] border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-52 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-24 animate-pulse" />
          </div>
        </div>
        <div className="p-0">
          <TableSkeleton rows={6} cols={5} />
        </div>
        <div className="border-border flex items-center justify-between border-t px-4 py-3">
          <Skeleton className="bg-muted h-3 w-28 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-16 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
