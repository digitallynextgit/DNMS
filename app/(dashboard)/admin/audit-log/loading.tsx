import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function AuditLogLoading() {
  return <TablePageSkeleton cols={7} rows={10} filters={3} />
}
