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
        <Skeleton key={i} className={cn("bg-muted w-full animate-pulse rounded-sm", height)} />
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-border bg-card rounded-sm border p-5">
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

/** Page title + subtitle, optionally with an action button on the right. Matches
 *  the <PageHeader> most pages render, so the header doesn't jump on hydrate. */
export function PageHeaderSkeleton({ withActions = false }: { withActions?: boolean }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-2.5">
        <Skeleton className="bg-muted h-5 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-4 w-64 animate-pulse" />
      </div>
      {withActions && (
        <div className="flex items-center gap-2">
          <Skeleton className="bg-muted h-9 w-24 animate-pulse" />
          <Skeleton className="bg-muted h-9 w-28 animate-pulse" />
        </div>
      )}
    </div>
  )
}

/** A single metric/stat card (label + big number + sub-line + corner icon). */
export function StatCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-sm border p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
          <Skeleton className="bg-muted h-7 w-1/3 animate-pulse" />
          <Skeleton className="bg-muted h-3 w-2/3 animate-pulse" />
        </div>
        <Skeleton className="bg-muted h-4 w-4 shrink-0 animate-pulse" />
      </div>
    </div>
  )
}

/** A row of stat cards. Same 4-up grid the dashboards/analytics use, so the KPI
 *  strip lands where the real cards will. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** A chart placeholder: a titled card with a sized block, not a bare list. */
export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="border-border bg-card space-y-3 rounded-sm border p-5">
      <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
      <Skeleton className={cn("bg-muted w-full animate-pulse rounded-sm", height)} />
    </div>
  )
}

/** Entity cards (projects / employees / recruitment): an avatar-or-logo block, a
 *  couple of text lines, and a footer row - NOT the stat-card shape. Rendered in
 *  the same 3-up grid the real card grids use so nothing reflows on load. */
export function EntityCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-border bg-card space-y-3 rounded-sm border p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="bg-muted h-3.5 w-2/3 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-1/2 animate-pulse" />
            </div>
          </div>
          <Skeleton className="bg-muted h-3 w-full animate-pulse" />
          <Skeleton className="bg-muted h-3 w-4/5 animate-pulse" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="bg-muted h-3 w-16 animate-pulse" />
            <Skeleton className="bg-muted h-6 w-16 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The admin/analytics dashboard shape: header, a 4-up stat strip, two charts,
 *  then two lists. Use this instead of PageSkeleton for pages that have no table. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListSkeleton rows={5} height="h-12" />
        <ListSkeleton rows={5} height="h-12" />
      </div>
    </div>
  )
}

/** A header + optional stat strip + a table card. The default shape for the many
 *  directory/list pages; pass the real column count for a closer match. */
export function TablePageSkeleton({
  cols = 5,
  rows = 8,
  withStats = false,
  statCount = 4,
}: {
  cols?: number
  rows?: number
  withStats?: boolean
  statCount?: number
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      {withStats && <StatCardsSkeleton count={statCount} />}
      <div className="border-border bg-card rounded-sm border">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
          <div className="flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-52 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-24 animate-pulse" />
          </div>
        </div>
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    </div>
  )
}

/** The profile / employee-detail shape: header, an avatar summary card, a 5-tab
 *  bar, then two info cards each with a 3-up grid of label/value rows. Shared so
 *  the route's loading.tsx and the client page's isLoading branch render the same
 *  thing - no reflow when the query resolves. */
export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

      {/* Summary card: avatar + name / meta / badges / contact. */}
      <div className="border-border bg-card rounded-sm border p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <Skeleton className="bg-muted h-24 w-24 shrink-0 animate-pulse rounded-full" />
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="bg-muted h-7 w-56 animate-pulse" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-28 animate-pulse" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="bg-muted h-5 w-20 animate-pulse rounded-full" />
              <Skeleton className="bg-muted h-5 w-24 animate-pulse rounded-full" />
            </div>
            <div className="flex flex-wrap gap-4">
              <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar (Info / Documents / Roles / Security / Notifications). */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-9 w-28 animate-pulse rounded-sm" />
        ))}
      </div>

      {/* Info tab: two cards, each a section title + a 3-up grid of label/value rows. */}
      {Array.from({ length: 2 }).map((_, card) => (
        <div key={card} className="border-border bg-card space-y-6 rounded-sm border p-6">
          <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="bg-muted h-3 w-24 animate-pulse" />
                <Skeleton className="bg-muted h-4 w-32 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between py-4">
        <div className="space-y-2.5">
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
          <div key={i} className="border-border bg-card rounded-sm border p-5">
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
      <div className="border-border bg-card rounded-sm border">
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
