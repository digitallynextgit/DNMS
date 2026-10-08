import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

export default function ClientsLoading() {
  return <TablePageSkeleton cols={7} withStats statCount={4} />
}
