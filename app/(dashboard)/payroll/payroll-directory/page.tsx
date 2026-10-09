"use client"

import { useState, useEffect } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { useDebounce } from "@/hooks/use-debounce"
import { useRouter } from "next/navigation"
import { useTenantPath } from "@/components/tenant-link"
import { useSession } from "next-auth/react"
import { Users, TrendingUp, DollarSign, Play, Trash2, Eye, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { FilterSelect, FilterToolbar } from "@/components/shared/filter-bar"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useRowSelection } from "@/hooks/use-row-selection"
import { GeneratePayrollDialog } from "@/features/payroll"
import {
  usePayrollRecords,
  usePayrollSummary,
  useUpdatePayrollStatus,
  useDeletePayrollRecord,
  type PayrollRecord,
} from "@/features/payroll"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { cn } from "@/lib/utils"
import {
  MONTHS,
  PAYROLL_STATUS_COLORS,
  PAYROLL_STATUS_LABELS,
  PERMISSIONS,
  TONE,
} from "@/lib/constants"

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const PAGE_SIZE = 10

export default function PayrollPage() {
  const router = useRouter()
  const tp = useTenantPath()
  const { can } = usePermissions()
  const { status: sessionStatus } = useSession()
  const canWrite = can(PERMISSIONS.PAYROLL_WRITE)
  const canProcess = can(PERMISSIONS.PAYROLL_PROCESS)

  // Overview is the HR payroll-run console; employees use My Payslips.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) {
      router.replace(tp("/payroll/me"))
    }
  }, [sessionStatus, canWrite, router])

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [status, setStatus] = useState("")
  const [query, setQuery] = useState("")
  // Debounced: every keystroke would otherwise be a server request.
  const employeeSearch = useDebounce(query.trim())
  const [page, setPage] = useUrlPage()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkStatusPending, setBulkStatusPending] = useState(false)

  // Reset to the first page whenever a filter changes.
  useUpdateEffect(() => {
    setPage(1)
  }, [month, year, status, employeeSearch])

  const recordFilters = {
    month: month ? Number(month) : undefined,
    year: year ? Number(year) : undefined,
    status: status || undefined,
    search: employeeSearch || undefined,
    page,
    limit: PAGE_SIZE,
  }

  const { data: recordsData, isLoading: recordsLoading } = usePayrollRecords(recordFilters)
  const { data: summaryData, isLoading: summaryLoading } = usePayrollSummary(
    month ? Number(month) : undefined,
    year ? Number(year) : undefined,
  )

  const updateStatus = useUpdatePayrollStatus()
  const deleteRecord = useDeletePayrollRecord()

  const records = recordsData?.data ?? []
  const pagination = recordsData?.pagination

  const summary = summaryData?.data

  const { selectedIds, count, isSelected, toggle, toggleAll, clear } = useRowSelection<string>(
    records.map((r) => r.id),
  )

  function handleClearFilters() {
    setMonth("")
    setYear("")
    setStatus("")
    setQuery("")
    setPage(1)
    clear()
  }

  async function handleBulkStatus(newStatus: string) {
    setBulkStatusPending(true)
    try {
      for (const id of selectedIds) {
        await updateStatus.mutateAsync({ id, status: newStatus })
      }
      clear()
    } finally {
      setBulkStatusPending(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deleteRecord.mutateAsync(deleteId)
    setDeleteId(null)
  }

  const statusBreakdown = summary?.statusBreakdown ?? {
    DRAFT: 0,
    PROCESSING: 0,
    APPROVED: 0,
    PAID: 0,
  }
  const breakdown: Record<string, number> = statusBreakdown
  // Counts are the month's totals, before the search.
  const statusViews = [
    {
      value: "ALL",
      label: "All",
      count: summary ? Object.values(breakdown).reduce((sum, n) => sum + n, 0) : undefined,
    },
    ...Object.entries(PAYROLL_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
      count: summary ? breakdown[value] : undefined,
    })),
  ]
  const tableFiltered = !!status || !!query

  const columns: DataTableColumn<PayrollRecord>[] = [
    {
      header: "Employee",
      exportValue: (record) => `${record.employee.firstName} ${record.employee.lastName}`,
      cell: (record) => (
        <div className="min-w-0">
          <p className="font-medium">
            {record.employee.firstName} {record.employee.lastName}
          </p>
          <p className="text-muted-foreground text-xs">{record.employee.employeeNo}</p>
        </div>
      ),
    },
    {
      header: "Employee No",
      defaultHidden: true,
      className: "font-mono text-xs",
      exportValue: (record) => record.employee.employeeNo,
      cell: (record) => record.employee.employeeNo,
    },
    {
      header: "Month",
      defaultHidden: true,
      exportValue: (record) => `${MONTHS[record.month - 1]} ${record.year}`,
      cell: (record) => `${MONTHS[record.month - 1]} ${record.year}`,
    },
    {
      header: "Department",
      className: "text-muted-foreground",
      exportValue: (record) => record.employee.department?.name ?? "",
      cell: (record) => record.employee.department?.name ?? "-",
    },
    {
      header: "Gross",
      align: "right",
      className: "font-medium",
      exportValue: (record) => record.grossSalary,
      cell: (record) => fmt(record.grossSalary),
    },
    {
      header: "Deductions",
      align: "right",
      className: "text-red-600",
      exportValue: (record) => record.totalDeductions,
      cell: (record) => fmt(record.totalDeductions),
    },
    {
      header: "Net",
      align: "right",
      className: "font-semibold text-emerald-600",
      exportValue: (record) => record.netSalary,
      cell: (record) => fmt(record.netSalary),
    },
    {
      header: "Generated",
      className: "text-muted-foreground text-xs",
      exportValue: (record) => record.createdAt.slice(0, 10),
      cell: (record) =>
        new Date(record.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
    {
      header: "Status",
      exportValue: (record) => PAYROLL_STATUS_LABELS[record.status] ?? record.status,
      cell: (record) => (
        <StatusBadge
          status={record.status}
          colorMap={PAYROLL_STATUS_COLORS}
          labelMap={PAYROLL_STATUS_LABELS}
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (record) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(tp(`/payroll/records/${record.id}`))}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canProcess && record.status === "DRAFT" && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteId(record.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`${MONTHS[Number(month) - 1] ?? "All months"} ${year}`}
        actions={
          canProcess ? (
            <Button className="gap-2" onClick={() => setGenerateOpen(true)}>
              <Play className="h-4 w-4" />
              Generate Payroll
            </Button>
          ) : undefined
        }
      />

      {/* Month and year also drive the cards below, so they stay above the table. */}
      <FilterToolbar
        hasActiveFilters={month !== "" || year !== "" || tableFiltered}
        onClear={handleClearFilters}
      >
        <FilterSelect
          value={month}
          onChange={setMonth}
          options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
          allLabel="All Months"
          className="w-[150px]"
        />
        <Input
          type="number"
          placeholder="Year"
          aria-label="Year"
          value={year}
          min={2020}
          max={2099}
          onChange={(e) => setYear(e.target.value)}
          className="h-9 w-[100px]"
        />
      </FilterToolbar>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Employees</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-9 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold">{summary?.employeeCount ?? 0}</p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-blue-50 dark:bg-blue-950/40">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Payroll</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-28" />
                ) : (
                  <p className="mt-1 text-2xl font-bold">{fmt(summary?.totalGross ?? 0)}</p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-emerald-50 dark:bg-emerald-950/40">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Net Payable (in hand)</p>
                {summaryLoading ? (
                  <Skeleton className="mt-1 h-8 w-28" />
                ) : (
                  <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {fmt(summary?.totalNet ?? 0)}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-violet-50 dark:bg-violet-950/40">
                <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusBreakdown).map(([s, statusCount]) => {
          const color = PAYROLL_STATUS_COLORS[s] ?? TONE.neutral
          const label = PAYROLL_STATUS_LABELS[s] ?? s
          return (
            <span
              key={s}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium",
                color,
              )}
            >
              {summaryLoading ? (
                <Skeleton className="h-3 w-3 rounded-sm" />
              ) : (
                <span className="font-bold">{statusCount}</span>
              )}
              {label}
            </span>
          )
        })}
      </div>

      {recordsLoading || records.length > 0 || tableFiltered ? (
        <DataTable
          tableId="payroll-records"
          exportName="payroll-records"
          columns={columns}
          rows={records}
          rowKey={(record) => record.id}
          showSerial
          serialOffset={(page - 1) * PAGE_SIZE}
          onRowClick={(record) => router.push(tp(`/payroll/records/${record.id}`))}
          selection={canProcess ? { isSelected, toggle, toggleAll, count, clear } : undefined}
          selectionActions={
            canProcess ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-1.5" variant="outline" disabled={bulkStatusPending}>
                    Update Status
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleBulkStatus("PROCESSING")}>
                    Mark as Processing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("APPROVED")}>
                    Mark as Approved
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("PAID")}>
                    Mark as Paid
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
          toolbar={
            <>
              <TableViewMenu
                label="Status"
                value={status || "ALL"}
                options={statusViews}
                onChange={(v) => setStatus(v === "ALL" ? "" : v)}
              />
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Search employee..."
                label="Search payroll records by employee"
              />
            </>
          }
          loading={recordsLoading}
          skeletonRows={PAGE_SIZE}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: setPage,
                  itemLabel: "record",
                  pageSize: PAGE_SIZE,
                }
              : undefined
          }
          empty="No payroll records match these filters."
        />
      ) : (
        <EmptyState
          title="No payroll records found."
          action={
            canProcess
              ? { label: "Generate Payroll", onClick: () => setGenerateOpen(true) }
              : undefined
          }
        />
      )}

      <GeneratePayrollDialog open={generateOpen} onOpenChange={setGenerateOpen} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Payroll Record"
        description="This will permanently delete this DRAFT payroll record. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteRecord.isPending}
      />
    </div>
  )
}
