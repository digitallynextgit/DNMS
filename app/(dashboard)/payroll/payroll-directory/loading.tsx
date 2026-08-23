import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function PayrollDirectoryLoading() {
  return <TablePageSkeleton withStats cols={6} rows={10} />
}
