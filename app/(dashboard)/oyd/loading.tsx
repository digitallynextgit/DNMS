import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={3} height="h-32" />
    </div>
  )
}
