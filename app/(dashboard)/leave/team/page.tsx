"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { PageHeader } from "@/components/shared/page-header"
import { LeaveRequestTable } from "@/features/leave"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLeaveRequests, useLeaveTypes } from "@/features/leave"
import { usePermissions } from "@/features/admin"
import { PERMISSIONS } from "@/lib/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { Pagination } from "@/components/shared/pagination"
import { X } from "lucide-react"

export default function TeamLeavePage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING")
  const [employeeSearch, setEmployeeSearchRaw] = useState("")
  const [leaveTypeId, setLeaveTypeId] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(employeeSearch, 350)

  const { data: typesData } = useLeaveTypes()
  const leaveTypes = typesData?.data ?? []

  const filters = {
    status: tab === "PENDING" ? "PENDING" : undefined,
    leaveTypeId: leaveTypeId === "all" ? undefined : leaveTypeId,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: 10,
  }

  const { data, isLoading } = useLeaveRequests(filters)

  const requests = data?.data ?? []
  const pagination = data?.pagination

  function handleClearFilters() {
    setEmployeeSearchRaw("")
    setLeaveTypeId("")
    setFrom("")
    setTo("")
    setPage(1)
  }

  const hasFilters = debouncedSearch || (leaveTypeId !== "all" ? leaveTypeId : "") || from || to

  if (!can(PERMISSIONS.LEAVE_APPROVE)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground text-sm">
          You do not have permission to view team leave requests.
        </p>
      </div>
    )
  }

  // Filter client-side by employee name search (since API filters by ID)
  const filteredRequests = debouncedSearch
    ? requests.filter((r) => {
        const fullName = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase()
        return (
          fullName.includes(debouncedSearch.toLowerCase()) ||
          r.employee.employeeNo.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
      })
    : requests

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Leave"
        description="Review and action leave requests from your team."
      />

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as "PENDING" | "ALL")
          setPage(1)
        }}
      >
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="ALL">All Requests</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <Input
            placeholder="Search employee..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearchRaw(e.target.value)}
          />
        </div>

        <Select
          value={leaveTypeId}
          onValueChange={(v) => {
            setLeaveTypeId(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
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
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            className="w-[150px]"
            placeholder="From"
          />
          <span className="text-muted-foreground text-sm">-</span>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            className="w-[150px]"
            placeholder="To"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
      ) : (
        <LeaveRequestTable
          requests={filteredRequests}
          showEmployee={true}
          canApprove={true}
          currentUserId={session?.user.id}
        />
      )}

      {/* Pagination */}
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
  )
}
