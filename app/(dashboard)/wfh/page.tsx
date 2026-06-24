"use client"

import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyWfhRequests, useWfhEligibility, useCancelWfh } from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Plus, Home, AlertTriangle, Ban, Inbox } from "lucide-react"

export default function MyWfhPage() {
  const { data: eligibility, isLoading: eligLoading } = useWfhEligibility()
  const { data: requestsData, isLoading: reqLoading } = useMyWfhRequests({ page: 1, limit: 30 })
  const cancel = useCancelWfh()

  const requests = requestsData?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work From Home"
        description="Apply for and track your WFH requests."
        actions={
          <Button asChild>
            <Link href="/wfh/apply" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Apply WFH
            </Link>
          </Button>
        }
      />

      {/* Eligibility card */}
      {eligLoading ? (
        <Skeleton className="h-24 rounded" />
      ) : eligibility ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded",
                  eligibility.tier === 3
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                )}
              >
                {eligibility.tier === 3 ? (
                  <Home className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                    Tier {eligibility.tier}
                  </span>
                  {eligibility.tier === 3 && (
                    <Badge variant="outline" className="text-xs">
                      {eligibility.usedThisMonth} / {eligibility.monthlyQuota} used this month
                    </Badge>
                  )}
                </div>
                <p className="text-foreground text-sm">{eligibility.label}</p>
                {eligibility.eligibleFromDate && eligibility.tier !== 3 && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Standard WFH eligibility from{" "}
                    <span className="text-foreground font-medium">
                      {new Date(eligibility.eligibleFromDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Requests list */}
      <div className="space-y-3">
        <h4 className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          Request History
        </h4>
        {reqLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <Inbox className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
              <p className="text-muted-foreground text-sm">No WFH requests yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-border border-b">
                    <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Reason</th>
                      <th className="px-4 py-2.5 font-medium">Type</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                          {new Date(r.date).toLocaleDateString("en-IN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td className="text-muted-foreground max-w-[300px] truncate px-4 py-2.5">
                          {r.reason || "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.isEmergency ? (
                            <Badge
                              variant="outline"
                              className="border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                            >
                              Emergency
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">Standard</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", LEAVE_STATUS_COLORS[r.status])}
                          >
                            {LEAVE_STATUS_LABELS[r.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {r.status === "PENDING" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => cancel.mutate(r.id)}
                              disabled={cancel.isPending}
                            >
                              <Ban className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
