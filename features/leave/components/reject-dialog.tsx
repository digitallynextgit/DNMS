"use client"

import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { useRejectLeave } from "@/features/leave/hooks/use-leave"

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string | null
}

export function RejectDialog({ open, onOpenChange, requestId }: RejectDialogProps) {
  const rejectLeave = useRejectLeave()

  async function handleConfirm(reason: string) {
    if (!requestId || !reason) return
    await rejectLeave.mutateAsync({ id: requestId, rejectionReason: reason })
    onOpenChange(false)
  }

  return (
    <RejectReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject Leave Request"
      description="Please provide a reason for rejecting this leave request. The employee will be notified."
      reasonLabel="Rejection Reason"
      reasonPlaceholder="Enter reason for rejection..."
      confirmLabel="Reject Request"
      isLoading={rejectLeave.isPending}
      onConfirm={handleConfirm}
    />
  )
}
