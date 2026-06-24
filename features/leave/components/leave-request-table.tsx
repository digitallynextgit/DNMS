"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RejectDialog } from "@/features/leave/components/reject-dialog"
import { useCancelLeave, useApproveLeave } from "@/features/leave/hooks/use-leave"
import type { LeaveRequest } from "@/features/leave/hooks/use-leave"
import { cn, formatDate, getInitials, getAvatarColor } from "@/lib/utils"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { Check, X, Ban } from "lucide-react"

interface LeaveRequestTableProps {
  requests: LeaveRequest[]
  showEmployee?: boolean
  canApprove?: boolean
  currentUserId?: string
}

export function LeaveRequestTable({
  requests,
  showEmployee = false,
  canApprove = false,
  currentUserId,
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
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground text-sm">No leave requests found.</p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="bg-card rounded border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b">
              {showEmployee && (
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
              )}
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Leave Type</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Dates</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Days</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Reason</th>
              <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((request) => {
              const fullName = `${request.employee.firstName} ${request.employee.lastName}`
              const initials = getInitials(request.employee.firstName, request.employee.lastName)
              const avatarBg = getAvatarColor(fullName)
              const statusLabel = LEAVE_STATUS_LABELS[request.status] ?? request.status
              const statusColor = LEAVE_STATUS_COLORS[request.status] ?? "bg-gray-100 text-gray-700"
              const isOwn = currentUserId === request.employeeId

              return (
                <tr key={request.id} className="hover:bg-muted/20 transition-colors">
                  {showEmployee && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                          {request.employee.profilePhoto ? (
                            <AvatarImage src={request.employee.profilePhoto} alt={fullName} />
                          ) : null}
                          <AvatarFallback
                            className={cn("text-xs font-semibold text-white", avatarBg)}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{fullName}</p>
                          <p className="text-muted-foreground text-xs">
                            {request.employee.employeeNo}
                          </p>
                        </div>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <p className="font-medium">{request.leaveType.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {request.leaveType.isPaid ? "Paid" : "Unpaid"}
                    </p>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                    {formatDate(request.startDate)}
                    {request.startDate !== request.endDate && <> - {formatDate(request.endDate)}</>}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{request.totalDays}</td>
                  <td className="max-w-[180px] px-4 py-3">
                    {request.reason ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-muted-foreground cursor-default truncate">
                            {request.reason}
                          </p>
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
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={cn("rounded-full border-0 text-xs font-medium", statusColor)}>
                      {statusLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
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
                      {/* No actions if already resolved */}
                      {!isOwn && !canApprove && (
                        <span className="text-muted-foreground/50 text-xs">-</span>
                      )}
                      {(request.status !== "PENDING" || (!isOwn && !canApprove)) &&
                        request.status !== "PENDING" && (
                          <span className="text-muted-foreground/50 text-xs">-</span>
                        )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        requestId={rejectingId}
      />
    </TooltipProvider>
  )
}
