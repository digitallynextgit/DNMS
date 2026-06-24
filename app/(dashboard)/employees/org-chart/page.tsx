"use client"

import { Loader2 } from "lucide-react"
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
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="text-muted-foreground flex items-center justify-center py-24 text-sm">
          Failed to load org chart. Please try again.
        </div>
      )}

      {!isLoading && !error && (
        <div className="bg-muted/20 min-h-[400px] rounded border">
          <OrgChartTree nodes={nodes} />
        </div>
      )}
    </div>
  )
}
