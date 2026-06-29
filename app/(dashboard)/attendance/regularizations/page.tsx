"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Plus, Check, X, Inbox, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RejectReasonDialog } from "@/components/shared/reject-reason-dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { getInitials, formatDate } from "@/lib/utils"

interface EmpSnippet {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
}

interface Regularization {
  id: string
  date: string
  requestedCheckIn: string | null
  requestedCheckOut: string | null
  reason: string
  status: keyof typeof LEAVE_STATUS_LABELS
  reviewNote: string | null
  createdAt: string
  employee: EmpSnippet
  reviewer: EmpSnippet | null
}

const time = (iso: string | null) => (iso ? iso.slice(11, 16) : "-")

const PAGE_SIZE = 10

interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

async function fetchRequests(
  page: number,
): Promise<{ data: Regularization[]; pagination: PaginationMeta }> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
  const res = await fetch(`/api/attendance/regularizations?${params.toString()}`)
  if (!res.ok) throw new Error("Failed to load requests")
  return res.json()
}

async function createRequest(body: {
  date: string
  checkIn?: string
  checkOut?: string
  reason: string
}) {
  const res = await fetch("/api/attendance/regularizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to submit" }))
    throw new Error(err.error?.message || "Failed to submit")
  }
  return res.json()
}

async function patchRequest(id: string, action: string, reviewNote?: string) {
  const res = await fetch(`/api/attendance/regularizations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reviewNote }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to update" }))
    throw new Error(err.error?.message || "Failed to update")
  }
  return res.json()
}

export default function RegularizationsPage() {
  const { can } = usePermissions()
  const canApprove = can(PERMISSIONS.ATTENDANCE_WRITE)
  const { data: session } = useSession()
  const myId = session?.user?.id
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ["regularizations", page],
    queryFn: () => fetchRequests(page),
  })
  const requests = data?.data ?? []
  const pagination = data?.pagination
  const selection = useRowSelection(requests.map((r) => r.id))

  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)
  const [date, setDate] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [reason, setReason] = useState("")

  const [rejectId, setRejectId] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["regularizations"] })

  const createMut = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      setPage(1)
      invalidate()
      toast.success("Regularization request submitted")
      setAddOpen(false)
      setDate("")
      setCheckIn("")
      setCheckOut("")
      setReason("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      patchRequest(id, action, note),
    onSuccess: (_d, v) => {
      invalidate()
      toast.success(
        v.action === "APPROVE"
          ? "Approved and applied to attendance"
          : v.action === "REJECT"
            ? "Request rejected"
            : "Request cancelled",
      )
      setRejectId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  async function handleBulkApprove() {
    const pendingIds = requests
      .filter((r) => selection.isSelected(r.id) && r.status === "PENDING")
      .map((r) => r.id)
    setBulkPending(true)
    try {
      for (const id of pendingIds) {
        await patchRequest(id, "APPROVE")
      }
      invalidate()
      selection.clear()
      setBulkOpen(false)
      toast.success("Requests approved and applied to attendance")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve")
    } finally {
      setBulkPending(false)
    }
  }

  const pendingSelectedCount = requests.filter(
    (r) => selection.isSelected(r.id) && r.status === "PENDING",
  ).length

  const columns: DataTableColumn<Regularization>[] = [
    ...(canApprove
      ? [
          {
            header: "Employee",
            cell: (r: Regularization) => (
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7">
                  {r.employee.profilePhoto && <AvatarImage src={r.employee.profilePhoto} />}
                  <AvatarFallback className="text-[10px]">
                    {getInitials(r.employee.firstName, r.employee.lastName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">
                  {r.employee.firstName} {r.employee.lastName}
                </span>
              </div>
            ),
          },
        ]
      : []),
    {
      header: "Date",
      className: "whitespace-nowrap",
      cell: (r) => formatDate(r.date, "dd MMM yyyy"),
    },
    { header: "In", className: "tabular-nums", cell: (r) => time(r.requestedCheckIn) },
    { header: "Out", className: "tabular-nums", cell: (r) => time(r.requestedCheckOut) },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[240px] truncate",
      cell: (r) => r.reason,
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
            {canApprove && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  disabled={patchMut.isPending}
                  onClick={() => patchMut.mutate({ id: r.id, action: "APPROVE" })}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={patchMut.isPending}
                  onClick={() => setRejectId(r.id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Reject
                </Button>
              </>
            )}
            {r.employee.id === myId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={patchMut.isPending}
                onClick={() => patchMut.mutate({ id: r.id, action: "CANCEL" })}
              >
                Cancel
              </Button>
            )}
          </div>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Regularization"
        description="Request a correction for a missed or wrong punch."
        actions={
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Raise Request
          </Button>
        }
      />

      {canApprove && (
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
      )}

      {isLoading ? (
        <ListSkeleton rows={3} height="h-14" />
      ) : requests.length === 0 ? (
        <EmptyState variant="card" icon={Inbox} title="No regularization requests yet." />
      ) : (
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(r) => r.id}
          minWidth="min-w-[760px]"
          showSerial
          serialOffset={((pagination?.page ?? 1) - 1) * PAGE_SIZE}
          selection={canApprove ? selection : undefined}
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

      {/* Raise request dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Raise Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="reg-date">Date</Label>
              <Input
                id="reg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="reg-in">Check In</Label>
                <Input
                  id="reg-in"
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-out">Check Out</Label>
                <Input
                  id="reg-out"
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-reason">Reason</Label>
              <Textarea
                id="reg-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Forgot to punch out, device was down..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!date || !reason.trim() || (!checkIn && !checkOut) || createMut.isPending}
              onClick={() =>
                createMut.mutate({
                  date,
                  checkIn: checkIn || undefined,
                  checkOut: checkOut || undefined,
                  reason: reason.trim(),
                })
              }
            >
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk approve confirmation */}
      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Approve ${pendingSelectedCount} request${pendingSelectedCount === 1 ? "" : "s"}?`}
        description="The selected pending requests will be approved and applied to attendance. Non-pending selections are ignored."
        confirmLabel="Approve"
        onConfirm={handleBulkApprove}
        isLoading={bulkPending}
      />

      {/* Reject dialog */}
      <RejectReasonDialog
        open={!!rejectId}
        onOpenChange={(o) => !o && setRejectId(null)}
        title="Reject Request"
        reasonLabel="Note (optional)"
        reasonPlaceholder="Reason for rejection..."
        required={false}
        confirmLabel="Reject"
        isLoading={patchMut.isPending}
        onConfirm={(note) => rejectId && patchMut.mutate({ id: rejectId, action: "REJECT", note })}
      />
    </div>
  )
}
