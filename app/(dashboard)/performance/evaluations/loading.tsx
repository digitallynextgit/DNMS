import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function EvaluationsLoading() {
  return <TablePageSkeleton cols={7} rows={10} filters={1} selectable />
}
