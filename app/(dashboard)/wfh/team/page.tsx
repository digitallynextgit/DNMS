"use client"

import { useState } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { useWfhRequests, useApproveWfh, useRejectWfh } from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { Check, X, AlertTriangle, Inbox } from "lucide-react"

export default function TeamWfhPage() {
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING")
  const [page, setPage] = useUrlPage()
  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const { data, isLoading } = useWfhRequests({
    status: tab === "PENDING" ? "PENDING" : undefined,
    page,
    limit: 10,
  })

  const approve = useApproveWfh()
  const reject = useRejectWfh()

  const requests = data?.data ?? []
  const pagination = data?.pagination
  const selection = useRowSelection(requests.map((r) => r.id))
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const pendingSelectedCount = requests.filter(
    (r) => selection.isSelected(r.id) && r.status === "PENDING",
  ).length

  function handleTabChange(v: string) {
    setTab(v as "PENDING" | "ALL")
    setPage(1)
  }

  function handleReject(reason: string) {
    if (!rejectingId || !reason) return
    reject.mutate(
      { id: rejectingId, rejectionReason: reason },
      {
        onSuccess: () => {
          setRejectingId(null)
        },
      },
    )
  }

  async function handleBulkApprove() {
    const ids = requests
      .filter((r) => selection.isSelected(r.id) && r.status === "PENDING")
      .map((r) => r.id)
    setBulkPending(true)
    try {
      for (const id of ids) {
        await approve.mutateAsync(id)
      }
      selection.clear()
      setBulkOpen(false)
    } finally {
      setBulkPending(false)
    }
  }

  type TeamWfhRow = (typeof requests)[number]
  const columns: DataTableColumn<TeamWfhRow>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={r.employee.profilePhoto}
            firstName={r.employee.firstName}
            lastName={r.employee.lastName}
            fallbackClassName="bg-muted text-[10px]"
            className="h-7 w-7"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.employee.firstName} {r.employee.lastName}
            </p>
            <p className="text-muted-foreground text-[11px]">{r.employee.employeeNo}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Date",
      className: "font-medium whitespace-nowrap",
      cell: (r) =>
        new Date(r.date).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }),
    },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[260px] truncate",
      cell: (r) => r.reason || "-",
    },
    {
      header: "Type",
      cell: (r) =>
        r.isEmergency ? (
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1 border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            <AlertTriangle className="h-3 w-3" />
            Emergency
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Standard</span>
        ),
    },
    {
      header: "Status",
      cell: (r) => (
        <StatusBadge
          status={r.status}
          colorMap={LEAVE_STATUS_COLORS}
          labelMap={LEAVE_STATUS_LABELS}
        />
      ),
    },
    {
      header: "Action",
      align: "right",
      cell: (r) =>
        r.status === "PENDING" ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={() => approve.mutate(r.id)}
              disabled={approve.isPending}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setRejectingId(r.id)}
              disabled={reject.isPending}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team WFH Requests"
        description="Approve or reject Work From Home requests from your team."
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <BulkActionBar count={selection.count} onClear={selection.clear}>
        <Button
          variant="default"
          size="sm"
          onClick={() => setBulkOpen(true)}
          disabled={bulkPending || pendingSelectedCount === 0}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Approve{pendingSelectedCount > 0 ? ` (${pendingSelectedCount})` : ""}
        </Button>
      </BulkActionBar>

      {isLoading ? (
        <ListSkeleton rows={3} height="h-16" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === "PENDING" ? "No pending WFH requests." : "No WFH requests yet."}
          variant="card"
        />
      ) : (
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(r) => r.id}
          minWidth="min-w-[780px]"
          showSerial
          serialOffset={((pagination?.page ?? 1) - 1) * 10}
          selection={selection}
        />
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

      {/* Bulk approve confirmation */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Approve ${pendingSelectedCount} request${pendingSelectedCount === 1 ? "" : "s"}?`}
        description="The selected pending WFH requests will be approved. Non-pending selections are ignored."
        confirmLabel="Approve"
        onConfirm={handleBulkApprove}
        isLoading={bulkPending}
      />

      {/* Reject dialog */}
      <RejectReasonDialog
        open={!!rejectingId}
        onOpenChange={(open) => !open && setRejectingId(null)}
        title="Reject WFH Request"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="Please provide a reason..."
        confirmLabel="Reject"
        isLoading={reject.isPending}
        onConfirm={handleReject}
      />
    </div>
  )
}
