import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

export default function ExitClearanceLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} height="h-24" />
    </div>
  )
}
