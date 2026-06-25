"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Plus, Check, X, Inbox, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { cn, getInitials, formatDate } from "@/lib/utils"

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

  const [addOpen, setAddOpen] = useState(false)
  const [date, setDate] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [reason, setReason] = useState("")

  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState("")

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
      setRejectNote("")
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded border py-16 text-center">
          <Inbox className="text-muted-foreground/40 mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">No regularization requests yet.</p>
        </div>
      ) : (
        <div className="bg-card overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                {canApprove && <th className="px-4 py-2.5 font-medium">Employee</th>}
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">In</th>
                <th className="px-4 py-2.5 font-medium">Out</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                  {canApprove && (
                    <td className="px-4 py-2.5">
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
                    </td>
                  )}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatDate(r.date, "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{time(r.requestedCheckIn)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{time(r.requestedCheckOut)}</td>
                  <td className="text-muted-foreground max-w-[240px] truncate px-4 py-2.5">
                    {r.reason}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", LEAVE_STATUS_COLORS[r.status])}
                    >
                      {LEAVE_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "PENDING" && (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* Raise request dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Raise Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="reg-date">Date</Label>
              <Input
                id="reg-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-in">Check In</Label>
                <Input
                  id="reg-in"
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-out">Check Out</Label>
                <Input
                  id="reg-out"
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
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

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reg-reject-note">Note (optional)</Label>
            <Textarea
              id="reg-reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={patchMut.isPending}
              onClick={() =>
                rejectId &&
                patchMut.mutate({ id: rejectId, action: "REJECT", note: rejectNote.trim() })
              }
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
