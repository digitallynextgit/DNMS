import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Bar width per column: a wide identity column first, narrow trailing ones. */
function cellWidth(index: number, cols: number) {
  if (index === 0) return "w-40"
  if (index === cols - 1) return "w-12"
  return index % 2 ? "w-24" : "w-20"
}

/** Header and rows of a DataTable, unframed - for a table that sits inside a card. */
export function TableSkeleton({
  rows = 5,
  cols = 5,
  serial = true,
  selectable = false,
}: {
  rows?: number
  cols?: number
  /** The S.No column. */
  serial?: boolean
  /** The tick-box column. */
  selectable?: boolean
}) {
  const line = (header: boolean, key: number) => (
    <div
      key={key}
      className={cn(
        "border-border flex items-center gap-8 border-b px-4",
        header ? "bg-muted/40 py-3.5" : "py-4 last:border-0",
      )}
    >
      {selectable && <Skeleton className="bg-muted h-4 w-4 shrink-0 animate-pulse rounded-sm" />}
      {serial && <Skeleton className="bg-muted h-3 w-5 shrink-0 animate-pulse" />}
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "bg-muted shrink-0 animate-pulse",
            header ? "h-3" : "h-4",
            cellWidth(i, cols),
            i === cols - 1 && "ml-auto",
          )}
        />
      ))}
    </div>
  )
  return (
    <div className="w-full overflow-hidden">
      {line(true, -1)}
      {Array.from({ length: rows }).map((_, i) => line(false, i))}
    </div>
  )
}

/**
 * Loading stand-in for a whole DataTable: the frame, its toolbar (view menu, search, filters,
 * Export, columns), the header and rows, and the paging footer.
 */
export function DataTableSkeleton({
  rows = 8,
  cols = 5,
  toolbar = true,
  filters = 0,
  selectable = false,
  serial = true,
  footer = true,
  className,
}: {
  rows?: number
  cols?: number
  toolbar?: boolean
  /** Filter boxes after the search. */
  filters?: number
  selectable?: boolean
  serial?: boolean
  footer?: boolean
  className?: string
}) {
  return (
    <div className={cn("border-border bg-card rounded-sm border", className)} aria-busy="true">
      {toolbar && (
        <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
          <Skeleton className="bg-muted h-9 w-20 animate-pulse" />
          <Skeleton className="bg-muted h-9 w-full max-w-[300px] min-w-40 flex-1 animate-pulse" />
          {Array.from({ length: filters }).map((_, i) => (
            <Skeleton key={i} className="bg-muted h-9 w-40 animate-pulse" />
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="bg-muted h-9 w-24 animate-pulse" />
            <Skeleton className="bg-muted h-9 w-9 animate-pulse" />
          </div>
        </div>
      )}
      <TableSkeleton rows={rows} cols={cols} serial={serial} selectable={selectable} />
      {footer && (
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5">
          <Skeleton className="bg-muted h-3 w-36 animate-pulse" />
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-8 w-32 animate-pulse" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="bg-muted h-8 w-8 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      )}
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

/** Matches <PageHeader>, so the header doesn't jump on hydrate. */
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

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="border-border bg-card space-y-3 rounded-sm border p-5">
      <Skeleton className="bg-muted h-4 w-40 animate-pulse" />
      <Skeleton className={cn("bg-muted w-full animate-pulse rounded-sm", height)} />
    </div>
  )
}

/** Project / employee / recruitment cards, in the same 3-up grid as the real ones. */
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

/** Header, stat strip, two charts, two lists - for dashboards with no table. */
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

/** The default shape for list pages; pass the real column count for a closer match. */
export function TablePageSkeleton({
  cols = 5,
  rows = 8,
  withStats = false,
  statCount = 4,
  filters = 0,
  selectable = false,
}: {
  cols?: number
  rows?: number
  withStats?: boolean
  statCount?: number
  /** Filter boxes in the table toolbar after the search. */
  filters?: number
  selectable?: boolean
}) {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      {withStats && <StatCardsSkeleton count={statCount} />}
      <DataTableSkeleton rows={rows} cols={cols} filters={filters} selectable={selectable} />
    </div>
  )
}

/** Profile / employee-detail shape, shared by loading.tsx and the page's isLoading branch. */
export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />

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

      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-9 w-28 animate-pulse rounded-sm" />
        ))}
      </div>

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
