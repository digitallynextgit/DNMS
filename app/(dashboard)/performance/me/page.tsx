"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Star, ChevronRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { EVALUATION_STATUS_COLORS, EVALUATION_STATUS_LABELS } from "@/lib/constants"
import { useEvaluations, type Evaluation } from "@/features/performance"

export default function MyPerformancePage() {
  const { data: session } = useSession()
  const myId = session?.user?.id
  const { data, isLoading } = useEvaluations({ limit: 50 })

  // Only the scorecards where I'm the employee being evaluated.
  const mine = (data?.data ?? []).filter((ev) => ev.employeeId === myId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Performance"
        description="Your self-evaluations and manager scorecards. Open one to rate yourself or see your result."
      />

      {isLoading ? (
        <ListSkeleton rows={3} height="h-20" />
      ) : mine.length === 0 ? (
        <EmptyState icon={Star} variant="card" title="No performance evaluations assigned yet." />
      ) : (
        <div className="space-y-3">
          {mine.map((ev: Evaluation) => {
            const selfPending = !ev.selfSubmittedAt
            return (
              <Card key={ev.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{ev.periodLabel}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusBadge
                        status={ev.status}
                        colorMap={EVALUATION_STATUS_COLORS}
                        labelMap={EVALUATION_STATUS_LABELS}
                      />
                      <span className="text-muted-foreground">
                        Self: {ev.selfSubmittedAt ? "submitted" : "pending"}
                      </span>
                      {ev.dueDate && (
                        <span className="text-muted-foreground">
                          · due {new Date(ev.dueDate).toLocaleDateString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Final score</p>
                      <p className="text-lg font-bold tabular-nums">
                        {ev.finalScore != null ? (
                          <>
                            {ev.finalScore}
                            <span className="text-muted-foreground text-sm font-normal">/100</span>
                          </>
                        ) : (
                          "-"
                        )}
                      </p>
                    </div>
                    <Button asChild size="sm" variant={selfPending ? "default" : "outline"}>
                      <Link href={`/performance/evaluations/${ev.id}`}>
                        {selfPending ? "Fill self-evaluation" : "Open"}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
