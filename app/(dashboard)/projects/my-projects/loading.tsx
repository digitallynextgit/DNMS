import { PageHeaderSkeleton, EntityCardGridSkeleton } from "@/components/shared/loading-skeleton"

// The projects board is a grid of project cards (logo + name + meta + footer),
// not a table - so it uses the entity-card grid, matching the real card shape
// and the md:grid-cols-2 lg:grid-cols-3 layout.
export default function MyProjectsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <EntityCardGridSkeleton count={6} />
    </div>
  )
}
