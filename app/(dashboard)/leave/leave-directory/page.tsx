"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { X } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/shared/search-input"
import { DateField } from "@/components/shared/date-field"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination } from "@/components/shared/pagination"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LeaveRequestTable,
  LeaveBalanceDirectory,
  useLeaveRequests,
  useLeaveTypes,
  useLeaveBalanceDirectory,
  type LeaveRequest,
} from "@/features/leave"
import { usePermissions } from "@/features/admin"
import { useUrlState } from "@/hooks/use-url-state"
import { PERMISSIONS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"

const PAGE_SIZE = 10

export default function LeaveDirectoryPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [tab, setTab] = useUrlState("tab", "requests")
  // Page is local (not URL-synced) so a tab switch does a single URL update -
  // calling two URL-state setters in one handler clobbers the tab change.
  const [page, setPage] = useState(1)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [leaveTypeId, setLeaveTypeId] = useState("all")
  const [status, setStatus] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const { data: typesData } = useLeaveTypes()
  const leaveTypes = typesData?.data ?? []

  // The "On Leave" tab is just approved requests; "Requests" honours the status filter.
  const onLeave = tab === "on-leave"
  const balancesTab = tab === "balances"
  const filters = {
    status: onLeave ? "APPROVED" : status === "all" ? undefined : status,
    leaveTypeId: leaveTypeId === "all" ? undefined : leaveTypeId,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
  }
  const { data, isLoading } = useLeaveRequests(filters)
  const requests = data?.data ?? []
  const pagination = data?.pagination

  // Balances tab: every employee's leave balances by type for the selected year.
  const [balanceYear, setBalanceYear] = useState(() => new Date().getFullYear())
  // Year range: from 2026 (system launch - no leave data before it) through next
  // year. e.g. in 2026 → [2026, 2027]; in 2029 → [2026, 2027, 2028, 2029, 2030].
  const LEAVE_START_YEAR = 2026
  const balanceYearEnd = Math.max(LEAVE_START_YEAR, new Date().getFullYear() + 1)
  const balanceYearOptions = Array.from(
    { length: balanceYearEnd - LEAVE_START_YEAR + 1 },
    (_, i) => LEAVE_START_YEAR + i,
  )
  const { data: balanceData, isLoading: balancesLoading } = useLeaveBalanceDirectory(balanceYear)
  const balanceEmployees = balanceData?.data ?? []
  const filteredBalances = employeeSearch
    ? balanceEmployees.filter((e) => {
        const q = employeeSearch.toLowerCase()
        return (
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeNo.toLowerCase().includes(q)
        )
      })
    : balanceEmployees

  // Client-side name search over the current page (the API filters by id).
  const filtered = employeeSearch
    ? requests.filter((r) => {
        const q = employeeSearch.toLowerCase()
        return (
          `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(q) ||
          r.employee.employeeNo.toLowerCase().includes(q)
        )
      })
    : requests

  const resetPage = () => setPage(1)
  function clearFilters() {
    setEmployeeSearch("")
    setLeaveTypeId("all")
    setStatus("all")
    setFrom("")
    setTo("")
    setPage(1)
  }
  const hasFilters = balancesTab
    ? !!employeeSearch
    : !!employeeSearch || leaveTypeId !== "all" || (!onLeave && status !== "all") || !!from || !!to

  if (!can(PERMISSIONS.LEAVE_APPROVE)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">
          You do not have permission to view the leave directory.
        </p>
      </div>
    )
  }

  const onLeaveColumns: DataTableColumn<LeaveRequest>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <AvatarDisplay
            src={r.employee.profilePhoto}
            firstName={r.employee.firstName}
            lastName={r.employee.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {r.employee.firstName} {r.employee.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{r.employee.employeeNo}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Leave Type",
      cell: (r) => (
        <>
          <p className="font-medium">{r.leaveType.name}</p>
          <p className="text-muted-foreground text-xs">{r.leaveType.isPaid ? "Paid" : "Unpaid"}</p>
        </>
      ),
    },
    {
      header: "Dates",
      className: "text-muted-foreground whitespace-nowrap",
      cell: (r) => (
        <>
          {formatDate(r.startDate)}
          {r.startDate !== r.endDate && <> - {formatDate(r.endDate)}</>}
        </>
      ),
    },
    { header: "Days", className: "text-muted-foreground", cell: (r) => r.totalDays },
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
  ]

  return (
    <div className="space-y-6">
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v)
          setPage(1)
        }}
        className="space-y-6"
      >
        <PageHeader
          title="Leave Directory"
          description="Review leave requests and see who's on leave across the company."
          actions={
            <TabsList>
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="on-leave">On Leave</TabsTrigger>
              <TabsTrigger value="balances">Balances</TabsTrigger>
            </TabsList>
          }
        />

        {/* Filters (shared; the status filter only applies to the Requests tab) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <SearchInput
              placeholder="Search employee..."
              value={employeeSearch}
              onChange={setEmployeeSearch}
            />
          </div>

          {/* Year picker applies to the Balances tab only. */}
          {balancesTab && (
            <Select value={String(balanceYear)} onValueChange={(v) => setBalanceYear(Number(v))}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {balanceYearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Type / status / date apply to the Requests & On Leave tabs only. */}
          {!balancesTab && (
            <>
              <Select
                value={leaveTypeId}
                onValueChange={(v) => {
                  setLeaveTypeId(v)
                  resetPage()
                }}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!onLeave && (
                <Select
                  value={status}
                  onValueChange={(v) => {
                    setStatus(v)
                    resetPage()
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <div className="w-[150px]">
                  <DateField
                    value={from}
                    onChange={(v) => {
                      setFrom(v)
                      resetPage()
                    }}
                    placeholder="From"
                  />
                </div>
                <span className="text-muted-foreground text-sm">-</span>
                <div className="w-[150px]">
                  <DateField
                    value={to}
                    onChange={(v) => {
                      setTo(v)
                      resetPage()
                    }}
                    placeholder="To"
                  />
                </div>
              </div>
            </>
          )}

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <TabsContent value="requests" className="space-y-4">
          {isLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : (
            <LeaveRequestTable
              requests={filtered}
              showEmployee
              canApprove
              currentUserId={session?.user.id}
              serialOffset={(page - 1) * PAGE_SIZE}
            />
          )}
          {pagination && pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
              itemLabel="request"
            />
          )}
        </TabsContent>

        <TabsContent value="on-leave" className="space-y-4">
          {isLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : filtered.length === 0 ? (
            <EmptyState compact title="No one is on leave for the selected filters." />
          ) : (
            <DataTable
              columns={onLeaveColumns}
              rows={filtered}
              rowKey={(r) => r.id}
              minWidth="min-w-[640px]"
              showSerial
              serialOffset={(page - 1) * PAGE_SIZE}
            />
          )}
          {pagination && pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
              itemLabel="record"
            />
          )}
        </TabsContent>

        <TabsContent value="balances" className="space-y-3">
          {balancesLoading ? (
            <ListSkeleton rows={6} height="h-14" />
          ) : filteredBalances.length === 0 ? (
            <EmptyState compact title="No employees match your search." />
          ) : (
            <>
              <LeaveBalanceDirectory employees={filteredBalances} leaveTypes={leaveTypes} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
