"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { useWfhRequests, useApproveWfh, useRejectWfh } from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { Check, X, AlertTriangle, Inbox } from "lucide-react"

export default function TeamWfhPage() {
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING")
  const [page, setPage] = useState(1)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const { data, isLoading } = useWfhRequests({
    status: tab === "PENDING" ? "PENDING" : undefined,
    page,
    limit: 10,
  })

  const approve = useApproveWfh()
  const reject = useRejectWfh()

  const requests = data?.data ?? []
  const pagination = data?.pagination

  function handleTabChange(v: string) {
    setTab(v as "PENDING" | "ALL")
    setPage(1)
  }

  function handleReject(reason: string) {
    if (!rejectingId || !reason) return
    reject.mutate(
      { id: rejectingId, rejectionReason: reason },
      {
        onSuccess: () => {
          setRejectingId(null)
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team WFH Requests"
        description="Approve or reject Work From Home requests from your team."
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <ListSkeleton rows={3} height="h-16" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "PENDING" ? "No pending WFH requests." : "No WFH requests yet."}
          variant="card"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-border border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                    <th className="px-4 py-2.5 font-medium">Employee</th>
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
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <AvatarDisplay
                            src={r.employee.profilePhoto}
                            firstName={r.employee.firstName}
                            lastName={r.employee.lastName}
                            fallbackClassName="bg-muted text-[10px]"
                            className="h-7 w-7"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {r.employee.firstName} {r.employee.lastName}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {r.employee.employeeNo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="text-muted-foreground max-w-[260px] truncate px-4 py-2.5">
                        {r.reason || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.isEmergency ? (
                          <Badge
                            variant="outline"
                            className="inline-flex items-center gap-1 border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Emergency
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Standard</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge
                          status={r.status}
                          colorMap={LEAVE_STATUS_COLORS}
                          labelMap={LEAVE_STATUS_LABELS}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              onClick={() => approve.mutate(r.id)}
                              disabled={approve.isPending}
                            >
                              <Check className="mr-1 h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectingId(r.id)}
                              disabled={reject.isPending}
                            >
                              <X className="mr-1 h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
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

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="request"
        />
      )}

      {/* Reject dialog */}
      <RejectReasonDialog
        open={!!rejectingId}
        onOpenChange={(open) => !open && setRejectingId(null)}
        title="Reject WFH Request"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="Please provide a reason..."
        confirmLabel="Reject"
        isLoading={reject.isPending}
        onConfirm={handleReject}
      />
    </div>
  )
}
