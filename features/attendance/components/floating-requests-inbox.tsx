"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, X, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"

export interface FloatingRequest {
  id: string
  status: keyof typeof LEAVE_STATUS_LABELS
  reason: string | null
  managerDecision: "APPROVED" | "REJECTED" | null
  rejectionReason: string | null
  createdAt: string
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    profilePhoto: string | null
  }
  holiday: { id: string; name: string; date: string }
}

async function fetchFloatingRequests(status: string): Promise<{ data: FloatingRequest[] }> {
  const res = await fetch(`/api/attendance/floating-holidays/requests?status=${status}&limit=100`)
  if (!res.ok) throw new Error("Failed to load floating requests")
  return res.json()
}
async function reviewFloatingRequest(
  id: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string,
) {
  const res = await fetch(`/api/attendance/floating-holidays/requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, rejectionReason }),
  })
  if (!res.ok) {
    throw new Error((await res.json().catch(() => ({})))?.error?.message || "Failed to update")
  }
  return res.json()
}

/** Floating-holiday approval inbox (manager approval first, HR final), used on the HR Holiday
 *  Calendar and the manager's Leave section. */
export function FloatingRequestsInbox() {
  const qc = useQueryClient()
  const [rejectId, setRejectId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["floating-holiday-requests", "PENDING"],
    queryFn: () => fetchFloatingRequests("PENDING"),
  })
  const requests = data?.data ?? []

  const reviewMut = useMutation({
    mutationFn: (v: { id: string; action: "APPROVE" | "REJECT"; reason?: string }) =>
      reviewFloatingRequest(v.id, v.action, v.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floating-holiday-requests"] })
      qc.invalidateQueries({ queryKey: ["floating-holidays"] })
      toast.success("Request updated")
      setRejectId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const columns: DataTableColumn<FloatingRequest>[] = [
    {
      header: "Employee",
      sortValue: (r) => `${r.employee.firstName} ${r.employee.lastName}`.trim(),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={r.employee.profilePhoto}
            firstName={r.employee.firstName}
            lastName={r.employee.lastName}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {r.employee.firstName} {r.employee.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{r.employee.employeeNo}</p>
          </div>
        </div>
      ),
    },
    { header: "Holiday", sortValue: (r) => r.holiday.name, cell: (r) => r.holiday.name },
    {
      header: "Date",
      className: "text-muted-foreground",
      sortValue: (r) => r.holiday.date,
      cell: (r) => formatDate(r.holiday.date, "EEE, dd MMM yyyy"),
    },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[280px] truncate",
      cell: (r) => <span title={r.reason ?? undefined}>{r.reason ?? "-"}</span>,
    },
    {
      header: "Manager",
      className: "max-w-[220px]",
      cell: (r) =>
        r.managerDecision === "APPROVED" ? (
          <StatusBadge
            status="APPROVED"
            colorMap={LEAVE_STATUS_COLORS}
            labelMap={LEAVE_STATUS_LABELS}
          />
        ) : r.managerDecision === "REJECTED" ? (
          <div className="space-y-0.5">
            <StatusBadge
              status="REJECTED"
              colorMap={LEAVE_STATUS_COLORS}
              labelMap={LEAVE_STATUS_LABELS}
            />
            {r.rejectionReason && (
              <p className="text-muted-foreground truncate text-xs" title={r.rejectionReason}>
                {r.rejectionReason}
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">Pending</span>
        ),
    },
    {
      header: "Status",
      sortValue: (r) => r.status,
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
      hideable: false,
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            disabled={reviewMut.isPending}
            onClick={() => reviewMut.mutate({ id: r.id, action: "APPROVE" })}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={reviewMut.isPending}
            onClick={() => setRejectId(r.id)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) return <ListSkeleton rows={4} height="h-14" />
  if (requests.length === 0) {
    return <EmptyState variant="card" icon={Inbox} title="No pending floating-holiday requests." />
  }

  return (
    <div className="space-y-4">
      <DataTable
        tableId="floating-requests"
        itemLabel="request"
        columns={columns}
        rows={requests}
        rowKey={(r) => r.id}
        minWidth="min-w-[840px]"
        showSerial
      />
      <RejectReasonDialog
        open={!!rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        title="Reject Floating Holiday"
        reasonLabel="Reason for rejection"
        reasonPlaceholder="Please provide a reason..."
        confirmLabel="Reject"
        isLoading={reviewMut.isPending}
        onConfirm={(reason) =>
          rejectId && reviewMut.mutate({ id: rejectId, action: "REJECT", reason })
        }
      />
    </div>
  )
}
