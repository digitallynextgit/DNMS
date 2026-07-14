"use client"

import { useState } from "react"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import Link from "next/link"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useRowSelection } from "@/hooks/use-row-selection"
import {
  useMyWfhRequests,
  useWfhEligibility,
  useCancelWfh,
  useWfhInbox,
  WfhRequestsInbox,
} from "@/features/wfh"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Plus, Home, AlertTriangle, Ban, Inbox } from "lucide-react"

export default function MyWfhPage() {
  const [page, setPage] = useUrlPage()
  const [tab, setTab] = useUrlState("tab", "my-wfh")
  const { data: eligibility, isLoading: eligLoading } = useWfhEligibility()
  const { data: requestsData, isLoading: reqLoading } = useMyWfhRequests({ page, limit: 10 })
  // Lightweight call: does this person manage anyone? (drives the team tab)
  const { data: inbox } = useWfhInbox("team", { limit: 1 })
  const cancel = useCancelWfh()

  const isManager = inbox?.isApprover ?? false
  const requests = requestsData?.data ?? []
  const pagination = requestsData?.pagination
  const selection = useRowSelection(requests.map((r) => r.id))
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkPending, setBulkPending] = useState(false)

  const pendingSelectedCount = requests.filter(
    (r) => selection.isSelected(r.id) && r.status === "PENDING",
  ).length

  async function handleBulkCancel() {
    const ids = requests
      .filter((r) => selection.isSelected(r.id) && r.status === "PENDING")
      .map((r) => r.id)
    setBulkPending(true)
    try {
      for (const id of ids) {
        await cancel.mutateAsync(id)
      }
      selection.clear()
      setBulkOpen(false)
    } finally {
      setBulkPending(false)
    }
  }

  type WfhRow = (typeof requests)[number]
  const columns: DataTableColumn<WfhRow>[] = [
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
      className: "text-muted-foreground max-w-[300px] truncate",
      cell: (r) => r.reason || "-",
    },
    {
      header: "Type",
      cell: (r) =>
        r.isEmergency ? (
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
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
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => cancel.mutate(r.id)}
            disabled={cancel.isPending}
          >
            <Ban className="mr-1 h-3.5 w-3.5" />
            Cancel
          </Button>
        ) : null,
    },
  ]

  const applyButton = (
    <Button asChild>
      <Link href="/wfh/apply" className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Apply WFH
      </Link>
    </Button>
  )

  // "My WFH" view: eligibility + the employee's own request history.
  const myWfh = (
    <>
      {eligLoading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : eligibility ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  eligibility.tier === 3
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                )}
              >
                {eligibility.tier === 3 ? (
                  <Home className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                    Tier {eligibility.tier}
                  </span>
                  {eligibility.tier === 3 && (
                    <Badge variant="outline" className="text-xs">
                      {eligibility.usedThisMonth} / {eligibility.monthlyQuota} used this month
                    </Badge>
                  )}
                </div>
                <p className="text-foreground text-sm">{eligibility.label}</p>
                {eligibility.eligibleFromDate && eligibility.tier !== 3 && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Standard WFH eligibility from{" "}
                    <span className="text-foreground font-medium">
                      {new Date(eligibility.eligibleFromDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        <h4 className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          Request History
        </h4>
        <BulkActionBar count={selection.count} onClear={selection.clear}>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkOpen(true)}
            disabled={bulkPending || pendingSelectedCount === 0}
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Cancel{pendingSelectedCount > 0 ? ` (${pendingSelectedCount})` : ""}
          </Button>
        </BulkActionBar>

        {reqLoading ? (
          <ListSkeleton rows={3} height="h-14" />
        ) : requests.length === 0 ? (
          <EmptyState icon={Inbox} title="No WFH requests yet." variant="card" />
        ) : (
          <DataTable
            columns={columns}
            rows={requests}
            rowKey={(r) => r.id}
            minWidth="min-w-[620px]"
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
      </div>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Cancel ${pendingSelectedCount} request${pendingSelectedCount === 1 ? "" : "s"}?`}
        description="The selected pending WFH requests will be cancelled. Non-pending selections are ignored."
        confirmLabel="Cancel requests"
        variant="destructive"
        onConfirm={handleBulkCancel}
        isLoading={bulkPending}
      />
    </>
  )

  // Non-managers: plain My WFH view (no tabs). HR uses the WFH section.
  if (!isManager) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Work From Home"
          description="Apply for and track your WFH requests."
          actions={applyButton}
        />
        {myWfh}
      </div>
    )
  }

  // Managers / HR: "My WFH" + "WFH Requests" (their team / all) tabs.
  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <PageHeader
          title="Work From Home"
          description="Your WFH, and the WFH requests awaiting your decision."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TabsList>
                <TabsTrigger value="my-wfh">My WFH</TabsTrigger>
                <TabsTrigger value="requests">WFH Requests</TabsTrigger>
              </TabsList>
              {applyButton}
            </div>
          }
        />

        <TabsContent value="my-wfh" className="space-y-6">
          {myWfh}
        </TabsContent>

        <TabsContent value="requests">
          <WfhRequestsInbox scope="team" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
