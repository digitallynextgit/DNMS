import { DataTableSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

export default function KpiProfilesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DataTableSkeleton cols={7} rows={10} />
    </div>
  )
}
