"use client"

import { PageHeader } from "@/components/shared/page-header"
import { DeliveryScoresView } from "@/features/projects/components/delivery-scores-view"

// Scoped server-side like Progress: admins see everyone, account managers their projects, team
// managers their teams and reports, members only themselves.
export default function TeamPerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Performance"
        description="One delivery score per person and team for the month - goals, deliverables and tasks on time - always with what it is made of."
      />
      <DeliveryScoresView />
    </div>
  )
}
