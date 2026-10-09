import { DataTableSkeleton, PageHeaderSkeleton } from "@/components/shared/loading-skeleton"

export default function MyPayslipsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <DataTableSkeleton cols={8} rows={8} />
    </div>
  )
}
