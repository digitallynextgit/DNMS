"use client"

import { PageHeader } from "@/components/shared/page-header"
import { WfhRequestsInbox } from "@/features/wfh"

// HR makes the final decision and can override a manager's advisory call. Gated on wfh:approve.
export default function WfhRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Work From Home"
        description="Review and action Work From Home requests from employees."
      />
      <WfhRequestsInbox scope="all" />
    </div>
  )
}
