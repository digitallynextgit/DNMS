import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function LeaveDirectoryLoading() {
  return <TablePageSkeleton withStats statCount={4} cols={6} rows={10} />
}
