import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/loading-skeleton"

// Mirrors the page's own loading branch: header with a tab strip, then the
// checklist table (employee, progress, start date, status, actions = 5 cols).
export default function OnboardingLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <div className="border-border bg-card rounded-sm border">
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  )
}
