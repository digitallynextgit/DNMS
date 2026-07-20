"use client"

import * as React from "react"
import { Spinner } from "@/components/shared/spinner"
import { buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { LeaveDecisionPreview } from "@/features/leave/components/leave-decision-preview"
import {
  useApproveLeave,
  useRejectLeave,
  type LeaveRequest,
} from "@/features/leave/hooks/use-leave"

/**
 * Approve / reject a leave request with a live preview of the exact email the
 * employee will receive - sent on the same thread they applied on. For a reject,
 * the required reason feeds straight into the preview as you type.
 */
export function LeaveDecisionDialog({
  open,
  onOpenChange,
  action,
  request,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "APPROVE" | "REJECT"
  request: LeaveRequest | null
}) {
  const approveLeave = useApproveLeave()
  const rejectLeave = useRejectLeave()
  const [reason, setReason] = React.useState("")

  React.useEffect(() => {
    if (open) setReason("")
  }, [open])

  if (!request) return null

  const isReject = action === "REJECT"
  const isLoading = approveLeave.isPending || rejectLeave.isPending
  const disabled = isLoading || (isReject && reason.trim().length === 0)
  const employeeName = `${request.employee.firstName} ${request.employee.lastName}`.trim()

  async function handleConfirm() {
    if (!request) return
    if (isReject) {
      await rejectLeave.mutateAsync({ id: request.id, rejectionReason: reason.trim() })
    } else {
      await approveLeave.mutateAsync(request.id)
    }
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg rounded">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold tracking-tight">
            {isReject ? "Reject Leave Request" : "Approve Leave Request"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            {isReject
              ? "Add a reason. The employee is emailed on the same thread they applied on."
              : "This is the email the employee will receive, on the same thread they applied on."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isReject && (
          <div className="space-y-2">
            <Label htmlFor="leave-reject-reason" className="text-sm">
              Rejection Reason<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="leave-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium">Mail preview</p>
          <LeaveDecisionPreview
            employeeName={employeeName}
            firstName={request.employee.firstName}
            leaveTypeName={request.leaveType.name}
            startDate={request.startDate}
            endDate={request.endDate}
            totalDays={request.totalDays}
            approved={!isReject}
            reason={reason}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="text-sm">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={disabled}
            className={cn(isReject && buttonVariants({ variant: "destructive" }))}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            {isReject ? "Reject & Send" : "Approve & Send"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
