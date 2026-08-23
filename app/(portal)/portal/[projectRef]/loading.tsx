import { TablePageSkeleton } from "@/components/shared/loading-skeleton"

// Renders inside the portal shell (sidebar/topbar preserved), so a client sees
// the portal chrome plus a shaped placeholder instead of the bare root spinner.
export default function PortalLoading() {
  return <TablePageSkeleton withStats statCount={3} cols={5} rows={8} />
}
