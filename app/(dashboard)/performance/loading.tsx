import {
  PageHeaderSkeleton,
  CardGridSkeleton,
  ListSkeleton,
} from "@/components/shared/loading-skeleton"

// Performance landing: header + summary cards + evaluations list.
export default function PerformanceLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton withActions />
      <CardGridSkeleton count={4} />
      <ListSkeleton rows={5} height="h-14" />
    </div>
  )
}
