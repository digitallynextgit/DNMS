"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardGridSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatStrip } from "@/components/shared/stat-strip"
import { LeaveBalanceCard } from "@/features/leave"
import { useLeaveBalances, useLeaveRequests, type LeaveRequest } from "@/features/leave"
import { formatDate } from "@/lib/utils"
import { LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { CalendarRange, AlertTriangle } from "lucide-react"

interface EmployeeLeaveTabProps {
  employeeId: string
}

export function EmployeeLeaveTab({ employeeId }: EmployeeLeaveTabProps) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  const { data: balancesData, isLoading: balancesLoading } = useLeaveBalances(employeeId, year)
  const { data: requestsData, isLoading: requestsLoading } = useLeaveRequests({
    employeeId,
    page: 1,
    limit: 50,
  })

  const balances = balancesData?.data ?? []
  const requests = requestsData?.data ?? []

  // Year dropdown - current and 2 previous years
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2]

  // Summary stats for the selected year
  const yearRequests = requests.filter((r) => new Date(r.startDate).getFullYear() === year)
  const approvedDays = yearRequests
    .filter((r) => r.status === "APPROVED")
    .reduce((sum, r) => sum + r.totalDays, 0)
  const pendingDays = yearRequests
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.totalDays, 0)
  const lateNoticeCount = yearRequests.filter(
    (r) => (r as { lateNoticePenalty?: boolean }).lateNoticePenalty,
  ).length

  const columns: DataTableColumn<LeaveRequest>[] = [
    {
      header: "Type",
      cell: (r) => (
        <>
          <div className="flex items-center gap-1.5">
            <span className="font-medium">{r.leaveType.name}</span>
            {!r.leaveType.isPaid && (
              <Badge variant="outline" className="h-4 py-0 text-[10px]">
                Unpaid
              </Badge>
            )}
          </div>
          <span className="text-muted-foreground text-xs">{r.leaveType.code}</span>
        </>
      ),
    },
    {
      header: "From",
      className: "whitespace-nowrap",
      cell: (r) => formatDate(r.startDate),
    },
    {
      header: "To",
      className: "whitespace-nowrap",
      cell: (r) => formatDate(r.endDate),
    },
    {
      header: "Days",
      align: "center",
      className: "font-medium",
      cell: (r) => r.totalDays,
    },
    {
      header: "Status",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge
            status={r.status}
            colorMap={LEAVE_STATUS_COLORS}
            labelMap={LEAVE_STATUS_LABELS}
          />
          {(r as { lateNoticePenalty?: boolean }).lateNoticePenalty && (
            <span title="Late notice - double salary deduction flagged">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Approver",
      className: "text-muted-foreground",
      cell: (r) => (r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : "-"),
    },
    {
      header: "Reason",
      className: "text-muted-foreground max-w-[200px] truncate",
      cell: (r) => r.reason || "-",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header with year selector */}
      <div className="-mt-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarRange className="text-muted-foreground h-4 w-4" />
          <h3 className="text-foreground text-sm font-semibold">Leave Overview</h3>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Year summary strip - compact, single row */}
      <StatStrip
        items={[
          {
            label: "Approved",
            value: approvedDays,
            suffix: approvedDays === 1 ? "day" : "days",
          },
          {
            label: "Pending",
            value: pendingDays,
            suffix: pendingDays === 1 ? "day" : "days",
            tone: pendingDays > 0 ? "warning" : "default",
          },
          {
            label: "Total Requests",
            value: yearRequests.length,
            suffix: yearRequests.length === 1 ? "request" : "requests",
          },
          {
            label: "Late Notice",
            value: lateNoticeCount,
            suffix: "flagged",
            tone: lateNoticeCount > 0 ? "danger" : "default",
          },
        ]}
      />

      {/* Leave balances */}
      <div className="space-y-3">
        <h4 className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          Balances · {year}
        </h4>
        {balancesLoading ? (
          <CardGridSkeleton count={4} />
        ) : balances.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              No leave balances allocated for {year}.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => (
              <LeaveBalanceCard key={b.id} balance={b} />
            ))}
          </div>
        )}
      </div>

      {/* Leave request history */}
      <div className="space-y-3">
        <h4 className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
          Request History · {year}
        </h4>
        {requestsLoading ? (
          <ListSkeleton rows={4} height="h-14" />
        ) : yearRequests.length === 0 ? (
          <EmptyState compact title={`No leave requests found for ${year}.`} />
        ) : (
          <DataTable columns={columns} rows={yearRequests} rowKey={(r) => r.id} showSerial />
        )}
      </div>
    </div>
  )
}
