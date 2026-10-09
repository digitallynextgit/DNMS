import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function DevicesLoading() {
  return <TablePageSkeleton cols={7} rows={8} selectable />
}
