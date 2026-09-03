"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/shared/page-header"
import { OrgChartTree } from "@/features/employees"
import { useOrgChart } from "@/features/employees"

/** A single org node card placeholder (matches the real w-36 node card). */
function OrgCardSkeleton() {
  return (
    <div className="bg-card border-border flex w-36 flex-col items-center gap-1.5 rounded-sm border px-3 py-2.5 shadow-sm">
      <Skeleton className="bg-muted h-9 w-9 animate-pulse rounded-full" />
      <Skeleton className="bg-muted h-3 w-20 animate-pulse" />
      <Skeleton className="bg-muted h-2.5 w-24 animate-pulse" />
    </div>
  )
}

export default function OrgChartPage() {
  const { data, isLoading, error } = useOrgChart()

  const nodes = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Org Chart" description="Visual overview of the company hierarchy" />

      {isLoading && (
        <div className="bg-muted/20 min-h-[400px] rounded-sm border">
          <div className="flex flex-col items-center gap-6 p-8">
            <OrgCardSkeleton />
            <div className="bg-muted h-6 w-0.5 animate-pulse" />
            <div className="flex flex-wrap items-start justify-center gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <OrgCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div className="text-muted-foreground flex items-center justify-center py-24 text-sm">
          Failed to load org chart. Please try again.
        </div>
      )}

      {!isLoading && !error && (
        <div className="bg-muted/20 min-h-[400px] rounded-sm border">
          <OrgChartTree nodes={nodes} />
        </div>
      )}
    </div>
  )
}
