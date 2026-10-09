import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function ApplicationsLoading() {
  return <TablePageSkeleton cols={6} rows={8} filters={1} />
}
