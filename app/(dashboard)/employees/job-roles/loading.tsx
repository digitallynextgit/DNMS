import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function JobRolesLoading() {
  return <TablePageSkeleton cols={5} rows={8} filters={1} />
}
