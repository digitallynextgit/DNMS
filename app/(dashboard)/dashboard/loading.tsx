import { DashboardSkeleton } from "@/components/shared/loading-skeleton"

// The dashboard has stat cards, charts and lists - never a data table - so it
// must not fall back to PageSkeleton (which draws a table + pagination that
// never appears here).
export default function DashboardLoading() {
  return <DashboardSkeleton />
}
