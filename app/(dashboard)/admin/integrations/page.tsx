"use client"

import { Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { IntegrationsForm, useSettings } from "@/features/settings"

export default function IntegrationsPage() {
  const { data, isLoading } = useSettings()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Email (SMTP), HR inbox and branding. Saved values are used immediately."
      />
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : (
        <IntegrationsForm settings={data} />
      )}
    </div>
  )
}
