"use client"

import { Spinner } from "@/components/shared/spinner"
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
          <Spinner size="xl" className="text-muted-foreground" />
        </div>
      ) : (
        <IntegrationsForm settings={data} />
      )}
    </div>
  )
}
