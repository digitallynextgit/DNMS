"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { X } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { DateField } from "@/components/shared/date-field"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TabsBar } from "@/components/shared/tabs-bar"
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
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { useUrlState } from "@/hooks/use-url-state"
import { PERMISSIONS, LEAVE_STATUS_LABELS, LEAVE_STATUS_COLORS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"

const PAGE_SIZE = 10

const STATUS_VIEWS = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
]

export function LeaveDirectoryClient() {
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

  const [balanceYear, setBalanceYear] = useState(() => new Date().getFullYear())
  // From 2026 (system launch - no leave data before it) through next year.
  const LEAVE_START_YEAR = 2026
  const balanceYearEnd = Math.max(LEAVE_START_YEAR, new Date().getFullYear() + 1)
  const balanceYearOptions = Array.from(
    { length: balanceYearEnd - LEAVE_START_YEAR + 1 },
    (_, i) => LEAVE_START_YEAR + i,
  )
  const { data: balanceData, isLoading: balancesLoading } = useLeaveBalanceDirectory(balanceYear)
  const balanceEmployees = balanceData?.data ?? []
  const q = employeeSearch.trim().toLowerCase()
  const filteredBalances = q
    ? balanceEmployees.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.employeeNo.toLowerCase().includes(q),
      )
    : balanceEmployees

  // Client-side name search over the current page (the API has no name search).
  const filtered = q
    ? requests.filter(
        (r) =>
          `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase().includes(q) ||
          r.employee.employeeNo.toLowerCase().includes(q),
      )
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
      className: "text-muted-foreground",
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

  const search = (
    <TableSearch
      value={employeeSearch}
      onChange={setEmployeeSearch}
      placeholder="Search employee..."
      label="Search employees by name or employee number"
    />
  )
  const clearButton = hasFilters ? (
    <Button className="h-9 gap-1" variant="ghost" onClick={clearFilters}>
      <X className="h-3.5 w-3.5" />
      Clear
    </Button>
  ) : null

  // Type and dates narrow both request tabs; the status view is Requests only.
  const requestFilters = (
    <>
      {!onLeave && (
        <TableViewMenu
          label="Status"
          value={status}
          options={STATUS_VIEWS}
          onChange={(v) => {
            setStatus(v)
            resetPage()
          }}
        />
      )}
      {search}
      <Select
        value={leaveTypeId}
        onValueChange={(v) => {
          setLeaveTypeId(v)
          resetPage()
        }}
      >
        <SelectTrigger className="h-9 w-[170px]">
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
      {clearButton}
    </>
  )

  const requestPagination = pagination && {
    page: pagination.page,
    totalPages: pagination.totalPages,
    total: pagination.total,
    onPageChange: setPage,
    pageSize: PAGE_SIZE,
  }
  const noMatch = q ? "No request on this page matches that search." : undefined

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
            <TabsBar
              spacing="none"
              items={[
                { value: "requests", label: "Requests" },
                { value: "on-leave", label: "On Leave" },
                { value: "balances", label: "Balances" },
              ]}
            />
          }
        />

        <TabsContent value="requests">
          <LeaveRequestTable
            tableId="leave-requests"
            requests={filtered}
            showEmployee
            canApprove
            currentUserId={session?.user.id}
            loading={isLoading}
            serialOffset={(page - 1) * PAGE_SIZE}
            pagination={requestPagination && { ...requestPagination, itemLabel: "request" }}
            toolbar={requestFilters}
            empty={noMatch}
          />
        </TabsContent>

        <TabsContent value="on-leave">
          <DataTable
            tableId="on-leave"
            columns={onLeaveColumns}
            rows={filtered}
            rowKey={(r) => r.id}
            minWidth="min-w-[640px]"
            showSerial
            serialOffset={(page - 1) * PAGE_SIZE}
            loading={isLoading}
            skeletonRows={5}
            pagination={requestPagination && { ...requestPagination, itemLabel: "record" }}
            toolbar={requestFilters}
            empty={noMatch ?? "No one is on leave for the selected filters."}
          />
        </TabsContent>

        <TabsContent value="balances">
          <LeaveBalanceDirectory
            employees={filteredBalances}
            leaveTypes={leaveTypes}
            loading={balancesLoading}
            year={balanceYear}
            pageKey={`${balanceYear}|${q}`}
            toolbar={
              <>
                {search}
                <Select
                  value={String(balanceYear)}
                  onValueChange={(v) => setBalanceYear(Number(v))}
                >
                  <SelectTrigger className="h-9 w-[130px]" aria-label="Year">
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
                {clearButton}
              </>
            }
            empty={q ? "No employees match your search." : "No leave balances to show yet."}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
