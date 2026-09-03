import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

// The directory is a stats strip over a table, so the placeholder is the same
// shape - no reflow when the list lands.
export default function ClientsLoading() {
  return <TablePageSkeleton cols={7} withStats statCount={4} />
}
