import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Salary Structures: header with an "Add Structure" action over a data table
// (Employee, Basic, HRA, Gross, Net, Effective From, actions + S.No), paginated.
export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card rounded-[2px] border">
        <TableSkeleton rows={10} cols={7} />
      </div>
    </div>
  )
}
