"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useRejectLeave } from "@/hooks/use-leave"

interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string | null
}

export function RejectDialog({ open, onOpenChange, requestId }: RejectDialogProps) {
  const [reason, setReason] = useState("")
  const rejectLeave = useRejectLeave()

  function handleClose(open: boolean) {
    if (!open) {
      setReason("")
    }
    onOpenChange(open)
  }

  async function handleConfirm() {
    if (!requestId || !reason.trim()) return
    await rejectLeave.mutateAsync({ id: requestId, rejectionReason: reason.trim() })
    setReason("")
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Leave Request</AlertDialogTitle>
          <AlertDialogDescription>
            Please provide a reason for rejecting this leave request. The employee will be notified.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="rejection-reason">Rejection Reason</Label>
          <Textarea
            id="rejection-reason"
            placeholder="Enter reason for rejection..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={rejectLeave.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!reason.trim() || rejectLeave.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {rejectLeave.isPending ? "Rejecting..." : "Reject Request"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
