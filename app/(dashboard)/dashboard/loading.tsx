import { DashboardSkeleton } from "@/components/shared/loading-skeleton"

// Not PageSkeleton: the dashboard has no data table.
export default function DashboardLoading() {
  return <DashboardSkeleton />
}
