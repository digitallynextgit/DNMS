"use client"

import { useState } from "react"
import { Check, X, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { useUrlPage } from "@/hooks/use-url-state"
import {
  useWfhInbox,
  useApproveWfh,
  useRejectWfh,
  formatWfhRangeLabel,
  formatWfhDaysCount,
  type WfhRequest,
} from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"

const PAGE_SIZE = 10

/** HR sees every pending request; a manager sees their team's. The first decision is final. */
export function WfhRequestsInbox({ scope = "team" }: { scope?: "team" | "all" }) {
  const [page, setPage] = useUrlPage("wfhReqPage")
  const [rejectId, setRejectId] = useState<string | null>(null)

  const { data, isLoading } = useWfhInbox(scope, { page, limit: PAGE_SIZE })
  const approve = useApproveWfh()
  const reject = useRejectWfh()

  const requests = data?.requests ?? []
  const pagination = data?.pagination

  const columns: DataTableColumn<WfhRequest>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={r.employee.profilePhoto}
            firstName={r.employee.firstName}
            lastName={r.employee.lastName}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {r.employee.firstName} {r.employee.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{r.employee.employeeNo}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Date",
      className: "text-muted-foreground",
      cell: (r) => {
        const days = formatWfhDaysCount(r.totalDays)
        return (
          <div className="space-y-0.5">
            <p>{formatWfhRangeLabel(r.date, r.endDate)}</p>
            {days && <p className="text-muted-foreground/70 text-xs">{days}</p>}
          </div>
        )
      },
    },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[280px] truncate",
      cell: (r) => <span title={r.reason ?? undefined}>{r.reason ?? "-"}</span>,
    },
    {
      header: "Type",
      cell: (r) =>
        r.isEmergency ? (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            Emergency
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Standard</span>
        ),
    },
    {
      header: "Manager",
      className: "max-w-[220px]",
      cell: (r) =>
        r.managerDecision === "APPROVED" ? (
          <StatusBadge
            status="APPROVED"
            colorMap={LEAVE_STATUS_COLORS}
            labelMap={LEAVE_STATUS_LABELS}
          />
        ) : r.managerDecision === "REJECTED" ? (
          <div className="space-y-0.5">
            <StatusBadge
              status="REJECTED"
              colorMap={LEAVE_STATUS_COLORS}
              labelMap={LEAVE_STATUS_LABELS}
            />
            {r.rejectionReason && (
              <p className="text-muted-foreground truncate text-xs" title={r.rejectionReason}>
                {r.rejectionReason}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/50 text-xs">-</span>
        ),
    },
    {
      header: "Status",
      cell: (r) => (
        <StatusBadge
          status={r.status}
          colorMap={LEAVE_STATUS_COLORS}
          labelMap={LEAVE_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Action",
      align: "right",
      hideable: false,
      cell: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              disabled={approve.isPending}
              onClick={() => approve.mutate(r.id)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              disabled={reject.isPending}
              onClick={() => setRejectId(r.id)}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground/50 text-xs">-</span>
        ),
    },
  ]

  if (isLoading) return <ListSkeleton rows={4} height="h-14" />
  if (requests.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Inbox}
        title={scope === "all" ? "No WFH requests yet." : "No WFH requests from your team."}
      />
    )
  }

  return (
    <div className="space-y-4">
      <DataTable
        tableId={scope === "all" ? "wfh-requests" : "team-wfh-requests"}
        columns={columns}
        rows={requests}
        rowKey={(r) => r.id}
        minWidth="min-w-[840px]"
        showSerial
        serialOffset={(page - 1) * PAGE_SIZE}
        pagination={
          pagination && {
            page: pagination.page,
            totalPages: pagination.totalPages,
            total: pagination.total,
            onPageChange: setPage,
            itemLabel: "request",
            pageSize: PAGE_SIZE,
          }
        }
        // Approving is this screen's job, so the phone card keeps full-size decision buttons.
        mobileCard={(r) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <AvatarDisplay
                  src={r.employee.profilePhoto}
                  firstName={r.employee.firstName}
                  lastName={r.employee.lastName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.employee.firstName} {r.employee.lastName}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatWfhRangeLabel(r.date, r.endDate)}
                    {formatWfhDaysCount(r.totalDays) && ` · ${formatWfhDaysCount(r.totalDays)}`}
                  </p>
                </div>
              </div>
              <StatusBadge
                status={r.status}
                colorMap={LEAVE_STATUS_COLORS}
                labelMap={LEAVE_STATUS_LABELS}
                size="xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {r.isEmergency ? (
                <Badge
                  variant="outline"
                  className="border-red-200 bg-red-50 text-[10px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                >
                  Emergency
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">Standard</span>
              )}
              {r.reason && <span className="text-muted-foreground text-xs">· {r.reason}</span>}
            </div>

            {r.status === "PENDING" && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button
                  className="gap-1.5"
                  variant="outline"
                  disabled={approve.isPending}
                  onClick={() => approve.mutate(r.id)}
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive gap-1.5"
                  onClick={() => setRejectId(r.id)}
                >
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            )}
          </div>
        )}
      />
      <RejectReasonDialog
        open={!!rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        title="Reject WFH request"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="Please provide a reason..."
        confirmLabel="Reject"
        isLoading={reject.isPending}
        onConfirm={(reason) =>
          rejectId &&
          reject.mutate(
            { id: rejectId, rejectionReason: reason },
            { onSuccess: () => setRejectId(null) },
          )
        }
      />
    </div>
  )
}
