import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// My Payslips: a title-only header over a data table (Month, Year, Gross,
// Deductions, Net, Generated, Status, View + S.No). Mirrors the DataTable frame
// so nothing shifts when the payslips arrive.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={8} cols={8} />
      </div>
    </div>
  )
}
