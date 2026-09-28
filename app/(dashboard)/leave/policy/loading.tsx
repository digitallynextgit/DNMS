import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

// Policy page: header + policy sections as a list.
export default function LeavePolicyLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <ListSkeleton rows={6} height="h-20" />
    </div>
  )
}
