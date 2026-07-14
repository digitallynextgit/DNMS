"use client"

import { Spinner } from "@/components/shared/spinner"
import { PageHeader } from "@/components/shared/page-header"
import { OrgChartTree } from "@/features/employees"
import { useOrgChart } from "@/features/employees"

export default function OrgChartPage() {
  const { data, isLoading, error } = useOrgChart()

  const nodes = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Org Chart" description="Visual overview of the company hierarchy" />

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Spinner size="xl" className="text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && (
        <div className="text-muted-foreground flex items-center justify-center py-24 text-sm">
          Failed to load org chart. Please try again.
        </div>
      )}

      {!isLoading && !error && (
        <div className="bg-muted/20 min-h-[400px] rounded-lg border">
          <OrgChartTree nodes={nodes} />
        </div>
      )}
    </div>
  )
}
