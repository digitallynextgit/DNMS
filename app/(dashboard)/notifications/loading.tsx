import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

// Mirrors NotificationsPage: header + action buttons, then the notification feed
// (bordered card rows: icon tile, title + timestamp, message line).
export default function NotificationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton withActions />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-card flex w-full items-start gap-3 rounded-[2px] border p-4">
            <Skeleton className="bg-muted mt-0.5 h-9 w-9 shrink-0 animate-pulse rounded" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="bg-muted h-4 w-48 animate-pulse" />
                <Skeleton className="bg-muted h-3 w-16 shrink-0 animate-pulse" />
              </div>
              <Skeleton className="bg-muted h-4 w-full max-w-md animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
