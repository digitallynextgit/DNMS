import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function LeaveTypesLoading() {
  return <TablePageSkeleton cols={8} rows={10} selectable />
}
