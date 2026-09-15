import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

export default function ExitDetailLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <ListSkeleton rows={6} height="h-16" />
    </div>
  )
}
