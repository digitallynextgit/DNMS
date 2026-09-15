"use client"

import * as React from "react"
import { use } from "react"
import { useSession } from "next-auth/react"
import { DoorOpen, ShieldAlert, XCircle } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { InfoRow } from "@/components/shared/info-row"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CHECKLIST_STATUS_COLORS, CHECKLIST_STATUS_LABELS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"
import { ChecklistView, canComplete, useChecklist, useCompleteExit } from "@/features/hr-checklists"

export default function ExitClearanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const { data: checklist, isLoading, isError } = useChecklist(id)
  const complete = useCompleteExit()
  const [confirm, setConfirm] = React.useState(false)

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
        title="Exit clearance not found"
        description="It may have been removed, or you may not have access to it."
      />
    )
  }

  const e = checklist.employee
  const isOpen = checklist.status === "IN_PROGRESS"

  // The same predicate the server enforces, so the button and the refusal can
  // never disagree about whether relieving may be issued.
  const gate = canComplete(
    checklist.items.map((i) => ({
      id: i.id,
      text: i.text,
      itemKind: i.itemKind,
      isRequired: i.isRequired,
      isDone: i.isDone,
    })),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/exit-clearance"
        title={`${e.firstName} ${e.lastName}`}
        description={
          <span className="text-muted-foreground text-sm">
            {e.designation?.title ?? e.employeeNo}
            {e.department?.name && ` · ${e.department.name}`}
          </span>
        }
        leading={
          <AvatarDisplay
            firstName={e.firstName}
            lastName={e.lastName}
            src={e.profilePhoto}
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
            <Button
              className="gap-1.5"
              onClick={() => setConfirm(true)}
              disabled={!gate.ok || complete.isPending}
              title={
                gate.ok ? undefined : `Waiting on: ${gate.blocking.map((b) => b.text).join(", ")}`
              }
            >
              <DoorOpen className="h-4 w-4" />
              Complete exit
            </Button>
          )
        }
      />

      <div className="bg-card grid gap-x-8 gap-y-1 rounded-sm border p-4 sm:grid-cols-2">
        <InfoRow label="Last working day" value={formatDate(checklist.anchorDate)} />
        <InfoRow label="Employee number" value={e.employeeNo} mono />
        <InfoRow
          label="Resignation"
          value={checklist.resignation ? `Accepted · ${checklist.resignation.status}` : "-"}
        />
        <InfoRow
          label="Clearances signed"
          value={`${checklist.progress.clearancesDone} of ${checklist.progress.clearancesTotal}`}
        />
      </div>

      {/* Stated up front, not buried at the bottom: this is the reason the
          Complete button is disabled, and the list of people to chase. */}
      {isOpen && !gate.ok && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-amber-500/10 px-3 py-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-sm">
            Relieving is blocked until {gate.blocking.length} clearance
            {gate.blocking.length === 1 ? " is" : "s are"} signed:{" "}
            <strong>{gate.blocking.map((b) => b.text).join(", ")}</strong>
          </span>
        </div>
      )}

      <ChecklistView checklist={checklist} currentUserId={session?.user?.id ?? ""} />

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Complete this exit?"
        description={`${e.firstName} ${e.lastName} will be marked RESIGNED, their account closed, and they will be removed from every project team. A relieving confirmation is emailed to them. This cannot be undone here.`}
        confirmLabel="Complete exit"
        variant="destructive"
        isLoading={complete.isPending}
        onConfirm={() => complete.mutate(checklist.id, { onSuccess: () => setConfirm(false) })}
      />
    </div>
  )
}
