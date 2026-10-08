import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function PortalLoading() {
  return <TablePageSkeleton withStats statCount={3} cols={5} rows={8} />
}
