"use client"

import { useState } from "react"
import { Check, X, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { Pagination } from "@/components/shared/pagination"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { useUrlPage } from "@/hooks/use-url-state"
import { useWfhInbox, useApproveWfh, useRejectWfh, type WfhRequest } from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"

const PAGE_SIZE = 10

/**
 * WFH approval inbox - HR sees every pending request, a manager sees their team's.
 * A manager's approve/reject is recorded as an advisory decision (shown in the
 * Manager column); HR makes the final call and can override a manager rejection.
 */
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
      className: "text-muted-foreground whitespace-nowrap",
      cell: (r) =>
        new Date(r.date).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
    },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[200px] truncate",
      cell: (r) => r.reason ?? "-",
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
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
            Approved
          </span>
        ) : r.managerDecision === "REJECTED" ? (
          <div className="space-y-0.5">
            <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
              Rejected
            </span>
            {r.rejectionReason && (
              <p className="text-muted-foreground text-xs">{r.rejectionReason}</p>
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
      cell: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              disabled={approve.isPending}
              onClick={() => approve.mutate(r.id)}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
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
        columns={columns}
        rows={requests}
        rowKey={(r) => r.id}
        minWidth="min-w-[840px]"
        showSerial
        serialOffset={(page - 1) * PAGE_SIZE}
      />
      {pagination && pagination.total > PAGE_SIZE && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="request"
        />
      )}
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
