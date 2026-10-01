import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

// Work report: header + the build-a-report card.
export default function WorkReportsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={4} height="h-12" />
    </div>
  )
}
