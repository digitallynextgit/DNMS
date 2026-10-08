import { PageHeaderSkeleton, EntityCardGridSkeleton } from "@/components/shared/loading-skeleton"

export default function MyProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <EntityCardGridSkeleton count={6} />
    </div>
  )
}
