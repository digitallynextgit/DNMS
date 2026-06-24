"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useWfhRequests, useApproveWfh, useRejectWfh } from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { cn, getInitials } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, AlertTriangle, Inbox } from "lucide-react"

export default function TeamWfhPage() {
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const { data, isLoading } = useWfhRequests({
    status: tab === "PENDING" ? "PENDING" : undefined,
    page: 1,
    limit: 50,
  })

  const approve = useApproveWfh()
  const reject = useRejectWfh()

  const requests = data?.data ?? []

  function handleReject() {
    if (!rejectingId || !rejectReason.trim()) return
    reject.mutate(
      { id: rejectingId, rejectionReason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectingId(null)
          setRejectReason("")
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team WFH Requests"
        description="Approve or reject Work From Home requests from your team."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "PENDING" | "ALL")}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Inbox className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              {tab === "PENDING" ? "No pending WFH requests." : "No WFH requests yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-border border-b">
                  <tr className="text-muted-foreground text-left text-xs tracking-wider uppercase">
                    <th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Reason</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            {r.employee.profilePhoto && (
                              <AvatarImage src={r.employee.profilePhoto} />
                            )}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(r.employee.firstName, r.employee.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {r.employee.firstName} {r.employee.lastName}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {r.employee.employeeNo}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="text-muted-foreground max-w-[260px] truncate px-4 py-2.5">
                        {r.reason || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.isEmergency ? (
                          <Badge
                            variant="outline"
                            className="inline-flex items-center gap-1 border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Emergency
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Standard</span>
                        )}
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
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject WFH Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason for rejection</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please provide a reason..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingId(null)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || reject.isPending}
            >
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
