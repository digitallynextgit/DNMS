import { Skeleton } from "@/components/ui/skeleton"
import {
  PageHeaderSkeleton,
  CardGridSkeleton,
  ListSkeleton,
} from "@/components/shared/loading-skeleton"

// Landing page: header + "Leave Balances" card grid + "Recent Requests" list,
// mirroring the non-manager My Leave view so nothing reflows on load.
export default function LeaveLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withActions />

      <section className="space-y-4">
        <Skeleton className="bg-muted h-5 w-48 animate-pulse" />
        <CardGridSkeleton count={4} />
      </section>

      <section className="space-y-4">
        <Skeleton className="bg-muted h-5 w-40 animate-pulse" />
        <ListSkeleton rows={4} height="h-14" />
      </section>
    </div>
  )
}
