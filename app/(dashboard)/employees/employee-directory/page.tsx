"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { Plus, Pencil, Trash2, Download, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { CardGridSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { ViewToggle, useViewMode } from "@/components/shared/view-toggle"
import { useRowSelection } from "@/hooks/use-row-selection"
import { EmployeeCard } from "@/features/employees"
import { EmployeeFilters } from "@/features/employees"
import { bulkTerminateEmployees } from "@/features/employees"
import {
  useEmployees,
  useDeleteEmployee,
  useActivateEmployee,
  useHardDeleteEmployee,
} from "@/features/employees"
import { usePermissions } from "@/features/admin"
import { useDebounce } from "@/hooks/use-debounce"
import { cn, formatDate, employeeSlug } from "@/lib/utils"
import { isOnProbation } from "@/features/employees"
import { EMPLOYEE_STATUS_LABELS, PERMISSIONS, PROBATION_BADGE } from "@/lib/constants"
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

  // ── URL-synced filters ────────────────────────────────────────────────────
  const [search, setSearchRaw] = useState(searchParams.get("search") ?? "")
  const [departmentId, setDepartmentId] = useState(searchParams.get("departmentId") ?? "")
  // Default to active employees (all departments). The URL param still wins so
  // shared/bookmarked filtered links keep working.
  const [status, setStatus] = useState(searchParams.get("status") ?? "ACTIVE")
  const [page, setPage] = useState(Number(searchParams.get("page") ?? "1"))

  const debouncedSearch = useDebounce(search, 350)

  // Sync URL helper
  const pushFilters = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams()
      const merged = {
        search: debouncedSearch,
        departmentId,
        status,
        page: String(page),
        ...overrides,
      }
      Object.entries(merged).forEach(([k, v]) => {
        if (v && v !== "1") params.set(k, v)
        else if (v === "1" && k === "page") {
          // skip page=1
        } else if (v) params.set(k, v)
      })
      router.replace(`${pathname}?${params.toString()}`)
    },
    [debouncedSearch, departmentId, status, page, router, pathname],
  )

  function handleSearchChange(v: string) {
    setSearchRaw(v)
    setPage(1)
  }

  function handleDepartmentChange(v: string) {
    setDepartmentId(v)
    setPage(1)
    pushFilters({ departmentId: v, page: "1" })
  }

  function handleStatusChange(v: string) {
    setStatus(v)
    setPage(1)
    pushFilters({ status: v, page: "1" })
  }

  function handleClearFilters() {
    setSearchRaw("")
    setDepartmentId("")
    setStatus("")
    setPage(1)
    router.replace(pathname)
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
  const { selectedIds, count, isSelected, toggle, toggleAll, clear, allSelected, someSelected } =
    useRowSelection<string>(pageIds)

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

  // Bulk terminate via the bulkTerminateEmployees server action.
  async function confirmBulkDelete() {
    if (count === 0) return
    setBulkBusy(true)
    try {
      const r = await bulkTerminateEmployees(selectedIds)
      if (!r.ok) throw new Error(r.error)
      toast.success(`Terminated ${r.data.data.count ?? count} employees`)
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      clear()
      setBulkDeleteOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk terminate failed")
    } finally {
      setBulkBusy(false)
    }
  }

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
            onSearchChange={handleSearchChange}
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
        <div className="bg-card rounded border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="w-10 px-3 py-3 text-left">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all on this page"
                  />
                </th>
                <th className="text-muted-foreground w-12 px-2 py-3 text-left font-medium">
                  S.No.
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Employee</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Department
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">
                  Designation
                </th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Status</th>
                <th className="text-muted-foreground px-4 py-3 text-left font-medium">Joined</th>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp, idx) => {
                const fullName = `${emp.firstName} ${emp.lastName}`
                const isActive = emp.isActive
                const sno = ((pagination?.page ?? 1) - 1) * (pagination?.limit ?? 10) + idx + 1
                const rowSelected = isSelected(emp.id)

                return (
                  <tr
                    key={emp.id}
                    className={cn(
                      "hover:bg-muted/20 transition-colors",
                      rowSelected && "bg-accent/30",
                    )}
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={rowSelected}
                        onCheckedChange={() => toggle(emp.id)}
                        aria-label={`Select ${fullName}`}
                      />
                    </td>
                    <td className="text-muted-foreground px-2 py-3 text-xs tabular-nums">{sno}</td>
                    {/* Employee column */}
                    <td className="px-4 py-3">
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
                            {fullName}
                          </p>
                          <p className="text-muted-foreground text-xs">{emp.employeeNo}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {emp.department?.name ?? "-"}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {emp.designation?.title ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            isActive
                              ? "bg-green-500/15 text-green-600 dark:text-green-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                        {isOnProbation(emp) && (
                          <StatusBadge
                            status="Probation"
                            label="Probation"
                            colorMap={{ Probation: PROBATION_BADGE }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatDate(emp.dateOfJoining)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isActive ? (
                          <>
                            {can(PERMISSIONS.EMPLOYEE_WRITE) && (
                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground h-8 w-8"
                                title="Edit"
                              >
                                <Link
                                  href={`/employees/${emp.id}/edit`}
                                  aria-label={`Edit ${fullName}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}
                            {can(PERMISSIONS.EMPLOYEE_DELETE) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive h-8 w-8"
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
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:bg-green-500/10 hover:text-green-600 dark:text-green-400 dark:hover:text-green-400"
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
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8"
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && (
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
