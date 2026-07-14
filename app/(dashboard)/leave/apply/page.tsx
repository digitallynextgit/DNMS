"use client"

import { PageHeader } from "@/components/shared/page-header"
import { ApplyLeaveForm } from "@/features/leave"

export default function ApplyLeavePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Leave"
        description="Submit a new leave request for approval."
        backHref="/leave"
        backLabel="Back to Leave"
      />

      <ApplyLeaveForm />
    </div>
  )
}
