"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import {
  DataTable,
  type DataTableColumn,
  type DataTableSelection,
} from "@/components/shared/data-table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RejectDialog } from "@/features/leave/components/reject-dialog"
import { useCancelLeave, useApproveLeave } from "@/features/leave/hooks/use-leave"
import type { LeaveRequest } from "@/features/leave/hooks/use-leave"
import { formatDate } from "@/lib/utils"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { Check, X, Ban } from "lucide-react"

interface LeaveRequestTableProps {
  requests: LeaveRequest[]
  showEmployee?: boolean
  canApprove?: boolean
  currentUserId?: string
  /** Render the leading auto-numbered S.No column (default on). */
  showSerial?: boolean
  /** Offset for the S.No when the parent paginates, e.g. (page - 1) * pageSize. */
  serialOffset?: number
  /** Optional multi-select wiring — pass `useRowSelection(pageIds)` to enable checkboxes. */
  selection?: DataTableSelection
}

export function LeaveRequestTable({
  requests,
  showEmployee = false,
  canApprove = false,
  currentUserId,
  showSerial = true,
  serialOffset = 0,
  selection,
}: LeaveRequestTableProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const cancelLeave = useCancelLeave()
  const approveLeave = useApproveLeave()

  function openRejectDialog(id: string) {
    setRejectingId(id)
    setRejectDialogOpen(true)
  }

  if (requests.length === 0) {
    return <EmptyState compact title="No leave requests found." />
  }

  const columns: DataTableColumn<LeaveRequest>[] = [
    ...(showEmployee
      ? [
          {
            header: "Employee",
            cell: (request: LeaveRequest) => (
              <div className="flex items-center gap-2">
                <AvatarDisplay
                  src={request.employee.profilePhoto}
                  firstName={request.employee.firstName}
                  lastName={request.employee.lastName}
                  size="sm"
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {request.employee.firstName} {request.employee.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs">{request.employee.employeeNo}</p>
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Leave Type",
      cell: (request) => (
        <>
          <p className="font-medium">{request.leaveType.name}</p>
          <p className="text-muted-foreground text-xs">
            {request.leaveType.isPaid ? "Paid" : "Unpaid"}
          </p>
        </>
      ),
    },
    {
      header: "Dates",
      className: "text-muted-foreground whitespace-nowrap",
      cell: (request) => (
        <>
          {formatDate(request.startDate)}
          {request.startDate !== request.endDate && <> - {formatDate(request.endDate)}</>}
        </>
      ),
    },
    {
      header: "Days",
      className: "text-muted-foreground",
      cell: (request) => request.totalDays,
    },
    {
      header: "Reason",
      className: "max-w-[180px]",
      cell: (request) => (
        <>
          {request.reason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-muted-foreground cursor-default truncate">{request.reason}</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {request.reason}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground/50">-</span>
          )}
          {request.rejectionReason && (
            <p className="text-destructive mt-0.5 truncate text-xs">
              Reason: {request.rejectionReason}
            </p>
          )}
        </>
      ),
    },
    {
      header: "Status",
      cell: (request) => (
        <StatusBadge
          status={request.status}
          colorMap={LEAVE_STATUS_COLORS}
          labelMap={LEAVE_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (request) => {
        const isOwn = currentUserId === request.employeeId
        return (
          <div className="flex items-center justify-end gap-1">
            {/* Employee can cancel their own pending requests */}
            {isOwn && request.status === "PENDING" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-7 w-7"
                    disabled={cancelLeave.isPending}
                    onClick={() => cancelLeave.mutate(request.id)}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    <span className="sr-only">Cancel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cancel request</TooltipContent>
              </Tooltip>
            )}
            {/* Approver actions */}
            {canApprove && request.status === "PENDING" && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground h-7 w-7 hover:text-green-600"
                      disabled={approveLeave.isPending}
                      onClick={() => approveLeave.mutate(request.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span className="sr-only">Approve</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Approve request</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                      onClick={() => openRejectDialog(request.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="sr-only">Reject</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject request</TooltipContent>
                </Tooltip>
              </>
            )}
            {request.status !== "PENDING" && (
              <span className="text-muted-foreground/50 text-xs">-</span>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <TooltipProvider>
      <DataTable
        columns={columns}
        rows={requests}
        rowKey={(request) => request.id}
        minWidth="min-w-[720px]"
        showSerial={showSerial}
        serialOffset={serialOffset}
        selection={selection}
      />

      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        requestId={rejectingId}
      />
    </TooltipProvider>
  )
}
