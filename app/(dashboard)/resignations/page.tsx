"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Loader2, UserMinus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import {
  useResignationsToReview,
  useReviewResignation,
  type ReviewableResignation,
} from "@/features/resignations"
import { cn, getInitials, getAvatarColor, formatDate } from "@/lib/utils"

export default function ResignationsPage() {
  const { data, isLoading } = useResignationsToReview()
  const reviewMut = useReviewResignation()

  const [approveTarget, setApproveTarget] = useState<ReviewableResignation | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReviewableResignation | null>(null)
  const [rejectNote, setRejectNote] = useState("")

  const resignations = data?.data ?? []
  const canReviewAll = data?.canReviewAll ?? false

  function confirmApprove() {
    if (!approveTarget) return
    reviewMut.mutate(
      { id: approveTarget.id, action: "APPROVE" },
      {
        onSuccess: () => {
          toast.success("Resignation approved — account deactivated")
          setApproveTarget(null)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  function confirmReject() {
    if (!rejectTarget) return
    reviewMut.mutate(
      { id: rejectTarget.id, action: "REJECT", note: rejectNote || undefined },
      {
        onSuccess: () => {
          toast.success("Resignation declined")
          setRejectTarget(null)
          setRejectNote("")
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resignations"
        description={
          canReviewAll
            ? "Review and approve pending resignations across the organisation"
            : "Review and approve resignations from your team"
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded" />
          ))}
        </div>
      ) : resignations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <UserMinus className="text-muted-foreground/50 mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">No pending resignations to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resignations.map((r) => {
            const fullName = `${r.employee.firstName} ${r.employee.lastName}`
            const initials = getInitials(r.employee.firstName, r.employee.lastName)
            const avatarBg = getAvatarColor(fullName)
            return (
              <div
                key={r.id}
                className="bg-card flex flex-col gap-4 rounded border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    {r.employee.profilePhoto ? (
                      <AvatarImage src={r.employee.profilePhoto} alt={fullName} />
                    ) : null}
                    <AvatarFallback className={cn("text-xs font-semibold text-white", avatarBg)}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">
                      {fullName}{" "}
                      <span className="text-muted-foreground text-xs">{r.employee.employeeNo}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {r.employee.designation?.title ?? "-"}
                      {r.employee.department?.name ? ` · ${r.employee.department.name}` : ""}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Applied {formatDate(r.createdAt)}
                      {r.requestedLastWorkingDate
                        ? ` · Requested last day ${formatDate(r.requestedLastWorkingDate)}`
                        : ""}
                    </p>
                    {r.reason && <p className="text-sm">{r.reason}</p>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    disabled={reviewMut.isPending}
                    onClick={() => {
                      setRejectNote("")
                      setRejectTarget(r)
                    }}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={reviewMut.isPending}
                    onClick={() => setApproveTarget(r)}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Approve
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Approve confirmation */}
      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this resignation?</AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget
                ? `${approveTarget.employee.firstName} ${approveTarget.employee.lastName} will be marked as RESIGNED and their account deactivated immediately. They will be signed out and can no longer log in. This cannot be undone here.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmApprove()
              }}
              disabled={reviewMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reviewMut.isPending ? "Approving..." : "Approve & deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline dialog with optional note */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-105">
          <DialogHeader>
            <DialogTitle>Decline resignation</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="reject-note">Note (optional)</Label>
            <Textarea
              id="reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason shared with the employee"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={reviewMut.isPending} onClick={confirmReject}>
              {reviewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
