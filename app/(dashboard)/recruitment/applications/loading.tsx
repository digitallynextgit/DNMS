import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Applications skeleton: header + the search/status/mode filter row, then the
 * applicants data table (Applicant / Role / Flags / Applied / Status / action),
 * matching the real page so nothing reflows when candidates load.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />

      {/* Filters: search box + two selects */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="bg-muted h-9 min-w-56 flex-1 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
        <Skeleton className="bg-muted h-9 w-40 animate-pulse" />
      </div>

      {/* Applicants table */}
      <div className="border-border bg-card overflow-x-auto rounded-sm border">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  )
}
