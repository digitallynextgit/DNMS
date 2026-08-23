import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function EmployeeDirectoryLoading() {
  return <TablePageSkeleton withStats cols={6} rows={10} />
}
