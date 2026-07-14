"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { Plus, Eye, Trash2, Download, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { useRowSelection } from "@/hooks/use-row-selection"
import { useUpdateEffect } from "@/hooks/use-update-effect"
import { EmployeeCard } from "@/features/employees"
import { EmployeeFilters } from "@/features/employees"
import { apiFetch } from "@/lib/api-fetch"
import {
  useEmployees,
  useDeleteEmployee,
  useActivateEmployee,
  useHardDeleteEmployee,
  type EmployeeListItem,
} from "@/features/employees"
import { usePermissions } from "@/features/admin"
import { useDebounce } from "@/hooks/use-debounce"
import { formatDate, employeeSlug } from "@/lib/utils"
import { isOnProbation } from "@/features/employees"
import {
  ACTIVE_STATUS_COLORS,
  ACTIVE_STATUS_LABELS,
  EMPLOYEE_STATUS_LABELS,
  PERMISSIONS,
  PROBATION_BADGE,
} from "@/lib/constants"
import { exportToCsv } from "@/lib/export-csv"

export default function EmployeesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { can } = usePermissions()

  // ── View mode ────────────────────────────────────────────────────────────
  // Table is the default; users can switch to card view via the toggle.
  const [viewMode, setViewMode] = useViewMode("employee-directory-view", "table")

  // ── Row action state ──────────────────────────────────────────────────────
  const [hardDeleteId, setHardDeleteId] = useState<string | null>(null)
  const deactivateEmployee = useDeleteEmployee()
  const activateEmployee = useActivateEmployee()
  const hardDeleteEmployee = useHardDeleteEmployee()

  // ── Bulk-selection state ──────────────────────────────────────────────────
  const queryClient = useQueryClient()
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)

  // ── URL-driven filters + pagination ───────────────────────────────────────
  // The URL query string is the single source of truth: department, status, and
  // page all live in `?…=` params, so the view survives refresh, deep-linking,
  // and browser back/forward. `setParams` is the only writer to the URL.
  const departmentId = searchParams.get("departmentId") ?? ""
  // Default to active employees; the URL param still wins for shared links.
  const status = searchParams.get("status") ?? "ACTIVE"
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))

  // The search box needs immediate local state for responsive typing; its
  // debounced value is what gets written to the URL (and drives the query).
  const [search, setSearch] = useState(searchParams.get("search") ?? "")
  const debouncedSearch = useDebounce(search, 350)

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        // Drop default values so a pristine view keeps a clean URL.
        const isDefault =
          value === "" ||
          (key === "status" && value === "ACTIVE") ||
          (key === "page" && value === "1")
        if (isDefault) params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  const setPage = useCallback((p: number) => setParams({ page: String(p) }), [setParams])

  // Push the debounced search term to the URL, resetting to page 1. Skips the
  // initial mount so a deep-linked ?page=N isn't wiped on first render.
  useUpdateEffect(() => {
    setParams({ search: debouncedSearch, page: "1" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function handleDepartmentChange(v: string) {
    setParams({ departmentId: v, page: "1" })
  }

  function handleStatusChange(v: string) {
    setParams({ status: v, page: "1" })
  }

  function handleClearFilters() {
    setSearch("")
    router.replace(pathname, { scroll: false })
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useEmployees({
    search: debouncedSearch,
    departmentId: departmentId || undefined,
    status: status || undefined,
    page,
    limit: 10,
  })

  const employees = data?.data ?? []
  const pagination = data?.pagination

  // ── Row action handlers ───────────────────────────────────────────────────
  async function confirmHardDelete() {
    if (!hardDeleteId) return
    await hardDeleteEmployee.mutateAsync(hardDeleteId)
    setHardDeleteId(null)
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const pageIds = useMemo(() => employees.map((e) => e.id), [employees])
  // The whole object goes to DataTable's `selection` prop (it renders the
  // select-all + per-row checkboxes); the page only needs these four directly.
  const selection = useRowSelection<string>(pageIds)
  const { selectedIds, count, isSelected, clear } = selection

  // Reset selection when filters change (different page contents).
  useEffect(() => {
    clear()
  }, [debouncedSearch, departmentId, status, page, clear])

  // CSV export of the currently selected rows.
  function exportSelectedCsv() {
    const selected = employees.filter((e) => isSelected(e.id))
    if (selected.length === 0) return
    const cols = ["Employee No", "Name", "Email", "Department", "Designation", "Status", "Joined"]
    const rows = selected.map((e) => [
      e.employeeNo,
      `${e.firstName} ${e.lastName}`,
      e.email,
      e.department?.name ?? "",
      e.designation?.title ?? "",
      EMPLOYEE_STATUS_LABELS[e.status] ?? e.status,
      e.dateOfJoining ? formatDate(e.dateOfJoining) : "",
    ])
    const filename = `employees-${new Date().toISOString().slice(0, 10)}.csv`
    exportToCsv(cols, rows, filename)
    toast.success(`Exported ${selected.length} employee${selected.length !== 1 ? "s" : ""}`)
  }

  // Bulk terminate via the /api/employees/bulk-terminate endpoint.
  async function confirmBulkDelete() {
    if (count === 0) return
    setBulkBusy(true)
    try {
      const body = await apiFetch<{ data: { data: { count: number } } }>(
        "/api/employees/bulk-terminate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        },
      )
      toast.success(`Terminated ${body.data.data.count ?? count} employees`)
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      clear()
      setBulkDeleteOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk terminate failed")
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: DataTableColumn<EmployeeListItem>[] = [
    {
      header: "Employee",
      cell: (emp) => (
        <Link
          href={`/employees/${employeeSlug(emp.employeeNo, emp.firstName, emp.lastName)}`}
          className="group flex items-center gap-3"
        >
          <AvatarDisplay
            src={emp.profilePhoto}
            firstName={emp.firstName}
            lastName={emp.lastName}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate font-medium underline-offset-4 group-hover:underline">
              {emp.firstName} {emp.lastName}
            </p>
            <p className="text-muted-foreground text-xs">{emp.employeeNo}</p>
          </div>
        </Link>
      ),
    },
    {
      header: "Department",
      className: "text-muted-foreground",
      cell: (emp) => emp.department?.name ?? "-",
    },
    {
      header: "Designation",
      className: "text-muted-foreground",
      cell: (emp) => emp.designation?.title ?? "-",
    },
    {
      header: "Status",
      cell: (emp) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            status={emp.isActive ? "ACTIVE" : "INACTIVE"}
            colorMap={ACTIVE_STATUS_COLORS}
            labelMap={ACTIVE_STATUS_LABELS}
          />
          {isOnProbation(emp) && (
            <StatusBadge
              status="Probation"
              label="Probation"
              colorMap={{ Probation: PROBATION_BADGE }}
            />
          )}
        </div>
      ),
    },
    {
      header: "Joined",
      className: "text-muted-foreground",
      cell: (emp) => formatDate(emp.dateOfJoining),
    },
    {
      header: "",
      align: "right",
      cell: (emp) => {
        const fullName = `${emp.firstName} ${emp.lastName}`
        return (
          <div className="flex items-center justify-end gap-1">
            {/* View profile - same destination as clicking the name. */}
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              title="View"
            >
              <Link
                href={`/employees/${employeeSlug(emp.employeeNo, emp.firstName, emp.lastName)}`}
                aria-label={`View ${fullName}`}
              >
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            {emp.isActive ? (
              <>
                {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deactivateEmployee.mutate(emp.id)}
                    disabled={deactivateEmployee.isPending}
                    title="Deactivate"
                    aria-label={`Deactivate ${fullName}`}
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                {can(PERMISSIONS.EMPLOYEE_WRITE) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400 dark:hover:text-green-400"
                    onClick={() => activateEmployee.mutate(emp.id)}
                    disabled={activateEmployee.isPending}
                    title="Reactivate"
                    aria-label={`Reactivate ${fullName}`}
                  >
                    <UserCheck className="h-4 w-4" />
                  </Button>
                )}
                {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setHardDeleteId(emp.id)}
                    title="Delete permanently"
                    aria-label={`Delete ${fullName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description={
          pagination
            ? `${pagination.total} employee${pagination.total !== 1 ? "s" : ""} total`
            : "Employee directory"
        }
        actions={
          can(PERMISSIONS.EMPLOYEE_WRITE) ? (
            <Button asChild>
              <Link href="/employees/new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Employee
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <EmployeeFilters
            search={search}
            onSearchChange={setSearch}
            departmentId={departmentId}
            onDepartmentChange={handleDepartmentChange}
            status={status}
            onStatusChange={handleStatusChange}
            onClear={handleClearFilters}
          />
        </div>

        {/* View toggle */}
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Loading state */}
      {isLoading &&
        (viewMode === "card" ? (
          <CardGridSkeleton count={8} />
        ) : (
          <ListSkeleton rows={8} height="h-14" />
        ))}

      {/* Empty state */}
      {!isLoading && employees.length === 0 && (
        <EmptyState
          title="No employees found."
          action={
            can(PERMISSIONS.EMPLOYEE_WRITE)
              ? { label: "Add First Employee", href: "/employees/new" }
              : undefined
          }
        />
      )}

      {/* Card View */}
      {!isLoading && employees.length > 0 && viewMode === "card" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canEdit={can(PERMISSIONS.EMPLOYEE_WRITE)}
              canDelete={can(PERMISSIONS.EMPLOYEE_DELETE)}
              onDelete={(id) => deactivateEmployee.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar - visible when at least one row is selected */}
      {viewMode === "table" && (
        <BulkActionBar count={count} onClear={clear}>
          <Button variant="outline" size="sm" onClick={exportSelectedCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          {can(PERMISSIONS.EMPLOYEE_DELETE) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Terminate
            </Button>
          )}
        </BulkActionBar>
      )}

      {/* Table View */}
      {!isLoading && employees.length > 0 && viewMode === "table" && (
        <DataTable
          columns={columns}
          rows={employees}
          rowKey={(emp) => emp.id}
          showSerial
          serialOffset={((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 10)}
          selection={selection}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  onPageChange: setPage,
                  itemLabel: "employee",
                }
              : undefined
          }
        />
      )}

      {/* Pagination - the table view renders its own inside <DataTable />. */}
      {pagination && !(!isLoading && employees.length > 0 && viewMode === "table") && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          itemLabel="employee"
        />
      )}

      {/* Hard-delete confirmation dialog */}
      <ConfirmDialog
        open={!!hardDeleteId}
        onOpenChange={(open) => !open && setHardDeleteId(null)}
        title="Delete employee permanently?"
        description="This permanently removes the employee record and cannot be undone. Their attendance, leave, payroll and document history will be detached or removed."
        confirmLabel={hardDeleteEmployee.isPending ? "Deleting..." : "Delete permanently"}
        variant="destructive"
        onConfirm={confirmHardDelete}
        isLoading={hardDeleteEmployee.isPending}
      />

      {/* Bulk terminate confirmation dialog */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Terminate ${count} employees?`}
        description="Each selected employee will be marked as terminated and deactivated. You can reverse this individually from their profile. Your own account, if selected, will be skipped."
        confirmLabel={bulkBusy ? "Terminating..." : "Terminate"}
        variant="destructive"
        onConfirm={confirmBulkDelete}
        isLoading={bulkBusy}
      />
    </div>
  )
}
