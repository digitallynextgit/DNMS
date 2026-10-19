import { PageHeaderSkeleton } from "@/components/shared/loading-skeleton"
import { WeeklyReviewSkeleton } from "@/features/joinee-scorecard"

export default function WeeklyReviewLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <WeeklyReviewSkeleton />
    </div>
  )
}
