"use client"

import { useState, useEffect } from "react"
import { useUrlPage } from "@/hooks/use-url-state"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Users, TrendingUp, DollarSign, Play, Trash2, Eye, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { useRowSelection } from "@/hooks/use-row-selection"
import { GeneratePayrollDialog } from "@/features/payroll"
import { PayrollFilters } from "@/features/payroll"
import {
  usePayrollRecords,
  usePayrollSummary,
  useUpdatePayrollStatus,
  useDeletePayrollRecord,
  type PayrollRecord,
} from "@/features/payroll"
import { usePermissions } from "@/features/admin"
import { cn } from "@/lib/utils"
import { MONTHS, PAYROLL_STATUS_COLORS, PAYROLL_STATUS_LABELS, PERMISSIONS } from "@/lib/constants"

function fmt(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function PayrollPage() {
  const router = useRouter()
  const { can } = usePermissions()
  const { status: sessionStatus } = useSession()
  const canWrite = can(PERMISSIONS.PAYROLL_WRITE)

  // Overview is the HR payroll-run console; employees use My Payslips.
  useEffect(() => {
    if (sessionStatus === "authenticated" && !canWrite) {
      router.replace("/payroll/me")
    }
  }, [sessionStatus, canWrite, router])

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [status, setStatus] = useState("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [page, setPage] = useUrlPage()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkStatusPending, setBulkStatusPending] = useState(false)

  // Server-side pagination: reset to the first page whenever a filter changes.
  // SearchInput debounces `employeeSearch` internally before it reaches state.
  useUpdateEffect(() => {
    setPage(1)
  }, [month, year, status, employeeSearch])

  const recordFilters = {
    month: month ? Number(month) : undefined,
    year: year ? Number(year) : undefined,
    status: status || undefined,
    search: employeeSearch || undefined,
    page,
    limit: 10,
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

  // Per-page row selection with an indeterminate "select all on page" master.
  const { selectedIds, count, isSelected, toggle, toggleAll, clear, allSelected, someSelected } =
    useRowSelection<string>(records.map((r) => r.id))

  function handleClearFilters() {
    setMonth("")
    setYear("")
    setStatus("")
    setEmployeeSearch("")
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`${MONTHS[Number(month) - 1] ?? "All months"} ${year}`}
        actions={
          can(PERMISSIONS.PAYROLL_PROCESS) ? (
            <Button onClick={() => setGenerateOpen(true)} className="gap-2">
              <Play className="h-4 w-4" />
              Generate Payroll
            </Button>
          ) : undefined
        }
      />

      {/* Month/Year selector */}
      <div className="flex flex-wrap items-center gap-3">
        <PayrollFilters
          month={month}
          onMonthChange={setMonth}
          year={year}
          onYearChange={setYear}
          status={status}
          onStatusChange={setStatus}
          employeeSearch={employeeSearch}
          onEmployeeSearchChange={setEmployeeSearch}
          onClear={handleClearFilters}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Total Employees</p>
                    <p className="mt-1 text-3xl font-bold">{summary?.employeeCount ?? 0}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 dark:bg-blue-950/40">
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
                    <p className="mt-1 text-2xl font-bold">{fmt(summary?.totalGross ?? 0)}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-emerald-50 dark:bg-emerald-950/40">
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
                    <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {fmt(summary?.totalNet ?? 0)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-violet-50 dark:bg-violet-950/40">
                    <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Status breakdown badges */}
      {!summaryLoading && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusBreakdown).map(([s, count]) => {
            const color = PAYROLL_STATUS_COLORS[s] ?? "bg-gray-100 text-gray-700"
            const label = PAYROLL_STATUS_LABELS[s] ?? s
            return (
              <span
                key={s}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  color,
                )}
              >
                <span className="font-bold">{count}</span>
                {label}
              </span>
            )
          })}
        </div>
      )}

      {/* Bulk actions */}
      {can(PERMISSIONS.PAYROLL_PROCESS) && (
        <BulkActionBar count={count} onClear={clear}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={bulkStatusPending} className="gap-1.5">
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
        </BulkActionBar>
      )}

      {/* Records table */}
      {recordsLoading ? (
        <ListSkeleton rows={5} height="h-14" />
      ) : records.length === 0 ? (
        <EmptyState
          title="No payroll records found."
          action={
            can(PERMISSIONS.PAYROLL_PROCESS)
              ? { label: "Generate Payroll", onClick: () => setGenerateOpen(true) }
              : undefined
          }
        />
      ) : (
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                {can(PERMISSIONS.PAYROLL_PROCESS) && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Select all on this page"
                    />
                  </th>
                )}
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Department
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Gross</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                  Deductions
                </th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Net</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Generated</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {records.map((record: PayrollRecord) => {
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => router.push(`/payroll/records/${record.id}`)}
                  >
                    {can(PERMISSIONS.PAYROLL_PROCESS) && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle(record.id)
                        }}
                      >
                        <Checkbox
                          checked={isSelected(record.id)}
                          onCheckedChange={() => toggle(record.id)}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {record.employee.firstName} {record.employee.lastName}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {record.employee.employeeNo}
                        </p>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {record.employee.department?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(record.grossSalary)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {fmt(record.totalDeductions)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                      {fmt(record.netSalary)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(record.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={record.status}
                        colorMap={PAYROLL_STATUS_COLORS}
                        labelMap={PAYROLL_STATUS_LABELS}
                      />
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/payroll/records/${record.id}`)}
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {can(PERMISSIONS.PAYROLL_PROCESS) && record.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-8 w-8"
                            onClick={() => setDeleteId(record.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!recordsLoading && pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="record"
        />
      )}

      {/* Generate dialog */}
      <GeneratePayrollDialog open={generateOpen} onOpenChange={setGenerateOpen} />

      {/* Delete confirmation */}
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
