import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the employee documents page: header + a stack of document rows
 *  (icon + name/meta + action buttons), matching DocumentList's own skeleton. */
export default function EmployeeDocumentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withActions />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border-border flex items-center gap-4 rounded-sm border p-4"
          >
            <Skeleton className="bg-muted h-10 w-10 animate-pulse rounded-sm" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
              <Skeleton className="bg-muted h-3 w-32 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="bg-muted h-8 w-8 animate-pulse rounded-sm" />
              <Skeleton className="bg-muted h-8 w-8 animate-pulse rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
