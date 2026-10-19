"use client"

import { use } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { WeeklyReview, useWeeklyReview } from "@/features/joinee-scorecard"

// Where a reporting manager fills in a joinee's weekly review - reachable without HR rights,
// from the Friday reminder and "Waiting on you". The API decides who may see and edit it.
export default function WeeklyReviewPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = use(params)
  const { data } = useWeeklyReview(employeeId)
  const who = data?.employee ? `${data.employee.firstName} ${data.employee.lastName}`.trim() : ""

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/clearances"
        backLabel="Back to Waiting on you"
        title={who ? `Weekly review · ${who}` : "Weekly review"}
        description="Every Friday for 90 days after the 15-day scorecard: a 1-5 score per parameter and a comment."
      />
      <WeeklyReview employeeId={employeeId} />
    </div>
  )
}
