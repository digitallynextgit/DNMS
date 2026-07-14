"use client"

import { useEffect, useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, UserMinus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import {
  useResignationsToReview,
  useReviewResignation,
  type ReviewableResignation,
} from "@/features/resignations"
import { cn, getAvatarColor, formatDate } from "@/lib/utils"

/**
 * Placeholder card built from the real resignation card's layout (bordered
 * panel, avatar + name/designation/applied lines on the left, Decline / Approve
 * buttons on the right) rather than a flat grey bar, so nothing reflows when
 * the requests arrive.
 */
function ResignationCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-4 rounded border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-8 w-24 rounded" />
      </div>
    </div>
  )
}

export default function ResignationsPage() {
  const router = useRouter()
  const [page, setPage] = useUrlPage()
  const { data, isLoading } = useResignationsToReview({ page, limit: 10 })
  const reviewMut = useReviewResignation()

  const [approveTarget, setApproveTarget] = useState<ReviewableResignation | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ReviewableResignation | null>(null)

  const resignations = data?.data ?? []
  const canReviewAll = data?.canReviewAll ?? false
  const pagination = data?.pagination
  const authorized = data?.authorized

  // Only HR/admin or managers with reports may review resignations. Send anyone
  // else back to where they came from (falling back to the dashboard).
  useEffect(() => {
    if (data && authorized === false) {
      toast.error("You don't have access to that page")
      if (window.history.length > 1) router.back()
      else router.replace("/dashboard")
    }
  }, [data, authorized, router])

  // Render nothing while redirecting an unauthorized user (avoids a content flash).
  if (authorized === false) return null

  function confirmApprove() {
    if (!approveTarget) return
    reviewMut.mutate(
      { id: approveTarget.id, action: "APPROVE" },
      {
        onSuccess: () => {
          toast.success("Resignation approved - account deactivated")
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ResignationCardSkeleton key={i} />
          ))}
        </div>
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
