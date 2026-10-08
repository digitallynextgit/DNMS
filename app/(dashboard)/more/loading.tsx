import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/loading-skeleton"

export default function MoreLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  )
}
