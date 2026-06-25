"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, UserMinus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import {
  useResignationsToReview,
  useReviewResignation,
  type ReviewableResignation,
} from "@/features/resignations"
import { cn, getAvatarColor, formatDate } from "@/lib/utils"

export default function ResignationsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useResignationsToReview({ page, limit: 10 })
  const reviewMut = useReviewResignation()

  const [approveTarget, setApproveTarget] = useState<ReviewableResignation | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReviewableResignation | null>(null)

  const resignations = data?.data ?? []
  const canReviewAll = data?.canReviewAll ?? false
  const pagination = data?.pagination

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

  function confirmReject(note: string) {
    if (!rejectTarget) return
    reviewMut.mutate(
      { id: rejectTarget.id, action: "REJECT", note: note || undefined },
      {
        onSuccess: () => {
          toast.success("Resignation declined")
          setRejectTarget(null)
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
        <ListSkeleton rows={3} height="h-24" />
      ) : resignations.length === 0 ? (
        <EmptyState icon={UserMinus} title="No pending resignations to review." variant="card" />
      ) : (
        <div className="space-y-3">
          {resignations.map((r) => {
            const fullName = `${r.employee.firstName} ${r.employee.lastName}`
            return (
              <div
                key={r.id}
                className="bg-card flex flex-col gap-4 rounded border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 gap-3">
                  <AvatarDisplay
                    src={r.employee.profilePhoto}
                    firstName={r.employee.firstName}
                    lastName={r.employee.lastName}
                    size="md"
                    fallbackClassName={cn(
                      "text-xs font-semibold text-white",
                      getAvatarColor(fullName),
                    )}
                    className="shrink-0"
                  />
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
                    onClick={() => setRejectTarget(r)}
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

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="request"
        />
      )}

      {/* Approve confirmation */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="Approve this resignation?"
        description={
          approveTarget
            ? `${approveTarget.employee.firstName} ${approveTarget.employee.lastName} will be marked as RESIGNED and their account deactivated immediately. They will be signed out and can no longer log in. This cannot be undone here.`
            : ""
        }
        confirmLabel="Approve & deactivate"
        variant="destructive"
        isLoading={reviewMut.isPending}
        onConfirm={confirmApprove}
      />

      {/* Decline dialog with optional note */}
      <RejectReasonDialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title="Decline resignation"
        reasonLabel="Note (optional)"
        reasonPlaceholder="Reason shared with the employee"
        required={false}
        confirmLabel="Decline"
        isLoading={reviewMut.isPending}
        onConfirm={confirmReject}
      />
    </div>
  )
}
