import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

// Team WFH view: header + request rows.
export default function WfhTeamLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} height="h-14" />
    </div>
  )
}
