import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function MyProjectsLoading() {
  return <TablePageSkeleton cols={9} rows={10} filters={1} selectable />
}
