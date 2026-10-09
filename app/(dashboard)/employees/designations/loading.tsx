import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function DesignationsLoading() {
  return <TablePageSkeleton cols={5} rows={10} selectable />
}
