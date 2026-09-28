import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shared/loading-skeleton"

// "More" menu (mobile): header + a grid of section cards.
export default function MoreLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  )
}
