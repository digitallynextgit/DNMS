"use client"

import * as React from "react"
import { use } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { useSession } from "next-auth/react"
import { CHECKLIST_STATUS_COLORS, CHECKLIST_STATUS_LABELS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import {
  ChecklistView,
  useCancelChecklist,
  useChecklist,
  useCompleteOnboarding,
} from "@/features/hr-checklists"

export default function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const { data: checklist, isLoading, isError } = useChecklist(id)
  const complete = useCompleteOnboarding()
  const cancel = useCancelChecklist()
  const [confirmComplete, setConfirmComplete] = React.useState(false)
  const [confirmCancel, setConfirmCancel] = React.useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-sm" />
        <Skeleton className="h-64 rounded-sm" />
      </div>
    )
  }

  if (isError || !checklist) {
    return (
      <EmptyState
        icon={XCircle}
        variant="card"
        title="Checklist not found"
        description="It may have been removed, or you may not have access to it."
      />
    )
  }

  const employee = checklist.employee
  const isOpen = checklist.status === "IN_PROGRESS"
  const allDone = checklist.progress.done === checklist.progress.total

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/onboarding"
        title={`${employee.firstName} ${employee.lastName}`}
        description={
          <span className="text-muted-foreground text-sm">
            {employee.designation?.title ?? employee.employeeNo}
            {employee.department?.name && ` · ${employee.department.name}`}
            {checklist.anchorDate && ` · joined ${formatDate(checklist.anchorDate)}`}
          </span>
        }
        leading={
          <AvatarDisplay
            firstName={employee.firstName}
            lastName={employee.lastName}
            src={employee.profilePhoto}
            size="lg"
          />
        }
        titleSuffix={
          <StatusBadge
            status={checklist.status}
            colorMap={CHECKLIST_STATUS_COLORS}
            labelMap={CHECKLIST_STATUS_LABELS}
            size="xs"
          />
        }
        actions={
          checklist.canWrite &&
          isOpen && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setConfirmCancel(true)}>
                Cancel
              </Button>
              <Button className="gap-1.5" onClick={() => setConfirmComplete(true)}>
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            </div>
          )
        }
      />

      <ChecklistView checklist={checklist} currentUserId={session?.user?.id ?? ""} />

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete this onboarding?"
        description={
          allDone
            ? "Every item is done. The checklist will be closed and kept as a record."
            : `${checklist.progress.total - checklist.progress.done} item(s) are still open. You can complete anyway - they will stay unticked on the record.`
        }
        confirmLabel="Complete"
        isLoading={complete.isPending}
        onConfirm={() =>
          complete.mutate(checklist.id, { onSuccess: () => setConfirmComplete(false) })
        }
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this checklist?"
        description="Use this when the joiner never started. The record is kept, marked cancelled."
        confirmLabel="Cancel checklist"
        variant="destructive"
        isLoading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate({ instanceId: checklist.id }, { onSuccess: () => setConfirmCancel(false) })
        }
      />
    </div>
  )
}
